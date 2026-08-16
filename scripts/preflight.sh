#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[[ -f "$ROOT/.env" ]] && set -a && source "$ROOT/.env" && set +a
HOST="${HULL_HOST:-hull.test}"

hull_owns_http() {
  docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null \
    | grep -qE '^hull-traefik .*127\.0\.0\.1:80->'
}

port_busy() {
  local p="$1"
  ss -ltn 2>/dev/null | grep -qE "127\\.0\\.0\\.1:${p}\\s" \
    || ss -ltn 2>/dev/null | grep -qE "\\*:${p}\\s"
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
