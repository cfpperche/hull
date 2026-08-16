#!/usr/bin/env bash
# Fill Traefik / CoreDNS templates for HULL_HOST.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/scripts/lib/env.sh"
hull_load_env "$ROOT/.env"
HOST="${HULL_HOST:-hull.test}"
MODE="${1:-prod}"
tmpl="$ROOT/deploy/traefik/dynamic.yml.tmpl"
if [[ "$MODE" == "dev" ]]; then
  tmpl="$ROOT/deploy/traefik/dynamic.dev.yml.tmpl"
fi

# basicAuth on the studio router. The rendered dynamic.yml is gitignored, so the
# hash never lands in the tree. `|` as the sed delimiter is safe: an apr1 hash is
# [./0-9A-Za-z$] plus `$` separators — no `|` and no `&` to re-expand.
command -v openssl >/dev/null || { echo "ERROR: openssl required" >&2; exit 1; }
DBGATE_USER="${HULL_DBGATE_USER:-hull}"
DBGATE_PASS="${HULL_DBGATE_PASSWORD:-hull-studio-lab-secret}"
DBGATE_USERS="${DBGATE_USER}:$(openssl passwd -apr1 "$DBGATE_PASS")"

sed -e "s/__HOST__/${HOST}/g" \
    -e "s|__DBGATE_USERS__|${DBGATE_USERS}|g" \
    "$tmpl" >"$ROOT/deploy/traefik/dynamic.yml"
# Double-escaped: sed eats one backslash level in the replacement, so a single
# \. here reached the Corefile as a bare . and the regex matched hull-test too.
host_dotted="${HOST//./\\\\.}"
sed "s/__HOST_DOTTED__/${host_dotted}/g" \
  "$ROOT/deploy/coredns/Corefile.tmpl" >"$ROOT/deploy/coredns/Corefile"
echo "EDGE_OK host=${HOST} mode=${MODE}"
