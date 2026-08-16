#!/usr/bin/env bash
# Fill Traefik / CoreDNS templates for HULL_HOST.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${HULL_HOST:-hull.test}"
MODE="${1:-prod}"
tmpl="$ROOT/deploy/traefik/dynamic.yml.tmpl"
if [[ "$MODE" == "dev" ]]; then
  tmpl="$ROOT/deploy/traefik/dynamic.dev.yml.tmpl"
fi
sed "s/__HOST__/${HOST}/g" "$tmpl" >"$ROOT/deploy/traefik/dynamic.yml"
# Double-escaped: sed eats one backslash level in the replacement, so a single
# \. here reached the Corefile as a bare . and the regex matched hull-test too.
host_dotted="${HOST//./\\\\.}"
sed "s/__HOST_DOTTED__/${host_dotted}/g" \
  "$ROOT/deploy/coredns/Corefile.tmpl" >"$ROOT/deploy/coredns/Corefile"
echo "EDGE_OK host=${HOST} mode=${MODE}"
