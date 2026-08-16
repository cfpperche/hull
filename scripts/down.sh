#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VOLUMES="${1:-}"
args=(down --remove-orphans)
[[ "$VOLUMES" == "-v" || "$VOLUMES" == "--volumes" ]] && args+=(-v)
docker compose --env-file "$ROOT/.env" -f "$ROOT/deploy/compose.yaml" -p hull "${args[@]}"
echo "DOWN_OK"
