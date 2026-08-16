#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/scripts/lib/env.sh"
hull_load_env "$ROOT/.env"
HOST="${HULL_HOST:-hull.test}"

hull_owns_http() {
  docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null \
    | grep -qE '^hull-traefik .*127\.0\.0\.1:80->'
}

port_busy() {
  # Match the port on any bind address. Checking only 127.0.0.1 and *: missed a
  # listener on 0.0.0.0:80 or [::]:80, so preflight passed and `compose up` then
  # died on "address already in use" — exactly what this check exists to prevent.
  local p="$1"
  [[ -n "$(ss -ltnH "sport = :${p}" 2>/dev/null)" ]]
}

fail_port() {
  echo "ERROR: 127.0.0.1:$1 is in use." >&2
  echo "https://${HOST}/ needs Hull's Traefik (this compose project) to own 80 and 443." >&2
  echo "Stop whatever is bound there, then retry." >&2
  exit 1
}

if hull_owns_http; then
  echo "preflight ok https://${HOST}/  (hull-traefik already on 80/443)"
else
  port_busy 80 && fail_port 80
  port_busy 443 && fail_port 443
  echo "preflight ok https://${HOST}/  (127.0.0.1:80 + :443)"
fi

if ! getent hosts "$HOST" >/dev/null 2>&1; then
  echo "WARNING: ${HOST} does not resolve. Run:  sudo $ROOT/scripts/setup-local.sh" >&2
fi
