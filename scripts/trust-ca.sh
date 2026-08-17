#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CA="$ROOT/deploy/certs/ca/ca.crt"
[[ -f "$CA" ]] || { echo "ERROR: missing $CA — run scripts/generate-certs.sh first" >&2; exit 1; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run with sudo to install the Hull CA:"
  echo "  sudo $0"
  exit 1
fi

# Rotation, not just installation. When the CA has been replaced, the bundle has
# to be rebuilt rather than appended to: two trusted "Hull Local CA" certificates
# with different keys is a state nobody enjoys debugging.
rotated() {
  local installed="$1"
  [[ -f "$installed" ]] && ! cmp -s "$installed" "$CA"
}

if [[ -d /usr/local/share/ca-certificates ]]; then
  dest=/usr/local/share/ca-certificates/hull-local-ca.crt
  if rotated "$dest"; then
    echo "TRUST_ROTATE  replacing the previously trusted Hull CA"
    install -m 0644 "$CA" "$dest"
    update-ca-certificates --fresh
  else
    install -m 0644 "$CA" "$dest"
    update-ca-certificates
  fi
  echo "TRUST_OK debian/ubuntu"
  exit 0
fi

if command -v update-ca-trust >/dev/null && [[ -d /etc/pki/ca-trust/source/anchors ]]; then
  dest=/etc/pki/ca-trust/source/anchors/hull-local-ca.crt
  rotated "$dest" && echo "TRUST_ROTATE  replacing the previously trusted Hull CA"
  install -m 0644 "$CA" "$dest"
  update-ca-trust extract
  echo "TRUST_OK fedora/rhel"
  exit 0
fi

echo "ERROR: unknown trust store. Import $CA in the browser as an authority." >&2
exit 1
