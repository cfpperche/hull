#!/usr/bin/env bash
# Remove Hull leftovers. Does not touch other compose projects or product volumes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
env_file=()
[[ -f "$ROOT/.env" ]] && env_file=(--env-file "$ROOT/.env")

compose() {
  docker compose "${env_file[@]}" -f "$ROOT/deploy/compose.yaml" -p hull "$@"
}

# Oneshot migrate + testdb
docker rm -f hull-migrate >/dev/null 2>&1 || true
compose --profile test stop testdb >/dev/null 2>&1 || true
compose --profile test rm -f testdb >/dev/null 2>&1 || true

# compose run leftovers (hull-migrate-run-*)
docker ps -aq --filter name='hull-migrate-run-' | xargs -r docker rm -f >/dev/null 2>&1 || true

# Dangling build layers only
docker image prune -f >/dev/null

echo "PRUNE_OK  hull group should show only running product services"
