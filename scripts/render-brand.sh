#!/usr/bin/env bash
# Render deploy/brand/config.json + Vite public copies from .env.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[[ -f "$ROOT/.env" ]] && set -a && source "$ROOT/.env" && set +a

HOST="${HULL_HOST:-hull.test}"
BRAND="${HULL_BRAND:-Hull}"
MARK="${HULL_MARK:-}"
if [[ -z "$MARK" ]]; then
  MARK="$(printf '%s' "$BRAND" | cut -c1)"
fi
[[ -n "$MARK" ]] || MARK=H

je() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

OUT="$ROOT/deploy/brand/config.json"
mkdir -p "$ROOT/deploy/brand"
cat >"$OUT" <<EOF
{
  "host": "$(je "$HOST")",
  "brand": "$(je "$BRAND")",
  "mark": "$(je "$MARK")"
}
EOF

for app in www web admin; do
  dest="$ROOT/apps/${app}/public"
  mkdir -p "$dest"
  cp "$OUT" "$dest/config.json"
done

echo "BRAND_OK host=${HOST} brand=${BRAND} mark=${MARK}"
