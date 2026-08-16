#!/usr/bin/env bash
# One-shot local HTTPS: Hull CA + /etc/hosts. Run once per machine.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Read .env like every other script does. Without this the white-label HULL_HOST
# never reaches /etc/hosts, and up.sh then issues certs and routers for a name
# that does not resolve. Sourced before the re-exec so --preserve-env has a value,
# and again after it, because the script restarts from the top as root.
if [[ -f "$ROOT/.env" ]]; then
  . "$ROOT/scripts/lib/env.sh"
  hull_load_env "$ROOT/.env"
fi
HOST="${HULL_HOST:-hull.test}"
export HULL_HOST="$HOST"
export HULL_STUDIO="${HULL_STUDIO:-0}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Need root for /etc/hosts and the OS trust store."
  exec sudo --preserve-env=HULL_HOST,HULL_STUDIO "$0" "$@"
fi

OWNER="${SUDO_USER:-root}"
if [[ "$OWNER" != "root" ]]; then
  sudo -u "$OWNER" --preserve-env=HULL_HOST "$ROOT/scripts/generate-certs.sh"
else
  "$ROOT/scripts/generate-certs.sh"
fi

NAMES=("$HOST" "www.$HOST" "app.$HOST" "admin.$HOST" "mail.$HOST" "s3.$HOST" "rustfs.$HOST")
# dbgate is opt-in (`--profile studio`). Do not install a permanent hosts entry
# for a SQL console that is off by default.
if [[ "${HULL_STUDIO:-0}" == "1" ]]; then
  NAMES+=("db.$HOST")
fi
if [[ -f "$ROOT/deploy/edge-hosts.txt" ]]; then
  while IFS= read -r line; do
    line="${line//$'\r'/}"
    [[ -n "$line" && "$line" != \#* ]] && NAMES+=("$line")
  done <"$ROOT/deploy/edge-hosts.txt"
fi

# Back the file up once, and make sure it ends in a newline before appending —
# an unterminated last line would otherwise be fused with our first entry.
cp -n /etc/hosts /etc/hosts.hull.bak 2>/dev/null || true
if [[ -s /etc/hosts && -n "$(tail -c1 /etc/hosts)" ]]; then
  printf '\n' >> /etc/hosts
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
  echo "WSL: launching Windows hosts + CA (UAC prompt)…"
  if [[ -n "${SUDO_USER:-}" ]]; then
    sudo -u "$SUDO_USER" --preserve-env=HULL_HOST,HULL_STUDIO "$ROOT/scripts/setup-windows-from-wsl.sh" || true
  else
    "$ROOT/scripts/setup-windows-from-wsl.sh" || true
  fi
fi

echo
echo "SETUP_OK  www https://${HOST}/   app https://app.${HOST}/   admin https://admin.${HOST}/"
echo "If the stack is down:  $ROOT/scripts/up.sh"
