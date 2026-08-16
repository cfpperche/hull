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

# Hull's own dangling layers only. A bare `docker image prune -f` is
# machine-global and contradicts this script's own promise not to touch other
# projects, so scope it to the label compose already stamps.
docker image prune -f --filter label=hull.project=hull >/dev/null

echo "PRUNE_OK  hull group should show only running product services"
