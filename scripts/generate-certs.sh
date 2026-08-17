#!/usr/bin/env bash
# Hull-owned PKI. Does not use mkcert.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT/deploy/certs"
CA_DIR="$CERT_DIR/ca"
HOST="${HULL_HOST:-hull.test}"
DAYS_CA="${HULL_CA_DAYS:-3650}"
DAYS_LEAF="${HULL_CERT_DAYS:-825}"

command -v openssl >/dev/null || { echo "ERROR: openssl required" >&2; exit 1; }
mkdir -p "$CA_DIR"

ca_is_constrained() {
  [[ -f "$CA_DIR/ca.crt" ]] || return 1
  openssl x509 -in "$CA_DIR/ca.crt" -noout -text 2>/dev/null \
    | grep -q "X509v3 Name Constraints"
}

# Rotation is opt-in and never implicit: replacing a CA that is already in the
# OS (and on WSL, the Windows) root store behind the operator's back is a worse
# bug than the unconstrained CA it replaces.
if [[ "${HULL_CA_ROTATE:-0}" == "1" && -f "$CA_DIR/ca.crt" ]]; then
  BACKUP="$CERT_DIR/ca.previous"
  echo "CA_ROTATE  replacing the CA and the leaf."
  echo "  Previous CA kept at: $BACKUP"
  echo "  If https stops working before you finish, roll back with:"
  echo "    cp $BACKUP/* $CA_DIR/ && rm -f $CERT_DIR/hull-cert.pem $CERT_DIR/hull-key.pem"
  echo "    $ROOT/scripts/generate-certs.sh && sudo $ROOT/scripts/trust-ca.sh"
  echo
  mkdir -p "$BACKUP"
  cp "$CA_DIR/ca.crt" "$BACKUP/ca.crt"
  cp "$CA_DIR/ca.key" "$BACKUP/ca.key"
  rm -f "$CA_DIR/ca.key" "$CA_DIR/ca.crt" "$CA_DIR/ca.srl"
  # The leaf is signed by the CA being retired, so it has to go too. Leaving it
  # would let needs_leaf() keep a certificate no trust store can chain.
  rm -f "$CERT_DIR/hull-cert.pem" "$CERT_DIR/hull-key.pem"
elif [[ -f "$CA_DIR/ca.crt" ]] && ! ca_is_constrained; then
  echo "NOTE: this CA has no name constraints, so a leak of ca.key would be"
  echo "      trusted for any name on the internet, not just *.${HOST} + localhost."
  echo "      To adopt them (re-trust required, UAC on WSL):"
  echo "        HULL_CA_ROTATE=1 $ROOT/scripts/generate-certs.sh && sudo $ROOT/scripts/trust-ca.sh"
fi

# Name constraints keep a leaked ca.key to *.test + localhost instead of the whole
# internet. Only applied when the CA is created: an existing unconstrained CA is
# left alone, since replacing it silently would break an already-trusted store.
# To adopt them: rm -rf deploy/certs && sudo ./scripts/setup-local.sh
if [[ ! -f "$CA_DIR/ca.key" || ! -f "$CA_DIR/ca.crt" ]]; then
  openssl req -x509 -newkey rsa:4096 -sha256 -days "$DAYS_CA" -nodes \
    -keyout "$CA_DIR/ca.key" \
    -out "$CA_DIR/ca.crt" \
    -subj "/O=Hull/CN=Hull Local CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -addext "nameConstraints=critical,permitted;DNS:.test,permitted;DNS:localhost,permitted;IP:127.0.0.1/255.255.255.255"
  chmod 600 "$CA_DIR/ca.key"
  echo "CA_OK $CA_DIR/ca.crt"
fi

leaf_sans() {
  [[ -f "$CERT_DIR/hull-cert.pem" ]] || return 1
  openssl x509 -in "$CERT_DIR/hull-cert.pem" -noout -ext subjectAltName 2>/dev/null \
    || openssl x509 -in "$CERT_DIR/hull-cert.pem" -noout -text
}

needs_leaf() {
  [[ ! -f "$CERT_DIR/hull-cert.pem" || ! -f "$CERT_DIR/hull-key.pem" ]] && return 0
  local sans
  sans=$(leaf_sans || true)
  echo "$sans" | grep -q "DNS:${HOST}" || return 0
  echo "$sans" | grep -q "DNS:\\*.${HOST}" || return 0
  echo "$sans" | grep -q "DNS:localhost" || return 0
  return 1
}

if ! needs_leaf; then
  echo "CERT_OK $CERT_DIR/hull-cert.pem"
  exit 0
fi

cnf=$(mktemp)
trap 'rm -f "$cnf" "$CERT_DIR/hull.csr"' EXIT
cat >"$cnf" <<EOF
[req]
distinguished_name = dn
req_extensions = v3_req
prompt = no
[dn]
O = Hull
CN = ${HOST}
[v3_req]
subjectAltName = @alt
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
[alt]
DNS.1 = ${HOST}
DNS.2 = *.${HOST}
DNS.3 = localhost
IP.1 = 127.0.0.1
EOF

openssl req -new -newkey rsa:2048 -nodes \
  -keyout "$CERT_DIR/hull-key.pem" \
  -out "$CERT_DIR/hull.csr" \
  -config "$cnf"
openssl x509 -req -in "$CERT_DIR/hull.csr" \
  -CA "$CA_DIR/ca.crt" -CAkey "$CA_DIR/ca.key" -CAcreateserial \
  -out "$CERT_DIR/hull-cert.pem" -days "$DAYS_LEAF" -sha256 \
  -extfile "$cnf" -extensions v3_req
chmod 600 "$CERT_DIR/hull-key.pem"
rm -f "$CERT_DIR/hull.csr"

# A leaf that does not chain is worse than no leaf: the stack comes up and every
# browser refuses it. Name constraints make this reachable — a permitted subtree
# that misses one SAN invalidates the whole certificate.
if ! openssl verify -CAfile "$CA_DIR/ca.crt" "$CERT_DIR/hull-cert.pem" >/dev/null 2>&1; then
  echo "ERROR: the issued certificate does not verify against $CA_DIR/ca.crt." >&2
  openssl verify -CAfile "$CA_DIR/ca.crt" "$CERT_DIR/hull-cert.pem" >&2 || true
  echo "       Refusing to leave an unusable certificate in place." >&2
  rm -f "$CERT_DIR/hull-cert.pem" "$CERT_DIR/hull-key.pem"
  exit 1
fi

echo "CERT_OK $CERT_DIR/hull-cert.pem  SAN=${HOST},*.${HOST},localhost"
