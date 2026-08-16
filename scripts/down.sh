#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VOLUMES="${1:-}"
args=(down --remove-orphans)
[[ "$VOLUMES" == "-v" || "$VOLUMES" == "--volumes" ]] && args+=(-v)
env_file=()
[[ -f "$ROOT/.env" ]] && env_file=(--env-file "$ROOT/.env")
# Include profile services (testdb, studio, dns) so the hull group empties.
docker compose "${env_file[@]}" -f "$ROOT/deploy/compose.yaml" -p hull \
  --profile test --profile studio --profile dns "${args[@]}"
echo "DOWN_OK"
