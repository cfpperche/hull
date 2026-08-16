#!/usr/bin/env bash
# One-shot local HTTPS: Hull CA + /etc/hosts. Run once per machine.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${HULL_HOST:-hull.test}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Need root for /etc/hosts and the OS trust store."
  exec sudo --preserve-env=HULL_HOST "$0" "$@"
fi

OWNER="${SUDO_USER:-root}"
if [[ "$OWNER" != "root" ]]; then
  sudo -u "$OWNER" --preserve-env=HULL_HOST "$ROOT/scripts/generate-certs.sh"
else
  "$ROOT/scripts/generate-certs.sh"
fi

NAMES=("$HOST" "www.$HOST" "app.$HOST" "admin.$HOST" "mail.$HOST" "s3.$HOST" "rustfs.$HOST" "db.$HOST")
if [[ -f "$ROOT/deploy/edge-hosts.txt" ]]; then
  while IFS= read -r line; do
    line="${line//$'\r'/}"
    [[ -n "$line" && "$line" != \#* ]] && NAMES+=("$line")
  done <"$ROOT/deploy/edge-hosts.txt"
fi

declare -A seen=()
for name in "${NAMES[@]}"; do
  [[ -n "${seen[$name]:-}" ]] && continue
  seen[$name]=1
  if grep -qE "^[[:space:]]*127\\.0\\.0\\.1[[:space:]]+${name}([[:space:]]|$)" /etc/hosts; then
    echo "hosts ok  ${name}"
  else
    printf '%s\n' "127.0.0.1  ${name}" >> /etc/hosts
    echo "hosts added  127.0.0.1  ${name}"
  fi
done

"$ROOT/scripts/trust-ca.sh"

if grep -qi microsoft /proc/version 2>/dev/null; then
  echo
  echo "WSL: add the same names to the Windows hosts file and trust deploy/certs/ca/ca.crt."
fi

echo
echo "SETUP_OK  www https://${HOST}/   app https://app.${HOST}/   admin https://admin.${HOST}/"
echo "If the stack is down:  $ROOT/scripts/up.sh"
