#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/check-deps.sh" up

name="hull-test-pg"
port="${HULL_TEST_PG_PORT:-55434}"
compose_env=()
[[ -f "$ROOT/.env" ]] && compose_env=(--env-file "$ROOT/.env")

compose() {
  docker compose "${compose_env[@]}" -f "$ROOT/deploy/compose.yaml" -p hull --profile test "$@"
}

if ! docker ps --format '{{.Names}}' | grep -qx "$name"; then
  docker rm -f "$name" >/dev/null 2>&1 || true
  compose up -d testdb
  echo -n "waiting for ${name}"
  ready=0
  for _ in $(seq 1 60); do
    if docker exec "$name" pg_isready -h 127.0.0.1 -U hull -d hull_test >/dev/null 2>&1; then
      ready=$((ready + 1))
      if [[ "$ready" -ge 3 ]]; then
        echo " ok"
        break
      fi
    else
      ready=0
    fi
    echo -n "."
    sleep 0.5
  done
fi

export HULL_DATABASE_URL="postgresql://hull:hull@127.0.0.1:${port}/hull_test"
HULL_PG_CONTAINER="$name" PGUSER=hull PGPASSWORD=hull PGDATABASE=hull_test HULL_SEED_DEMO=0 \
  "$ROOT/scripts/migrate.sh"
cd "$ROOT/api"
uv sync --extra dev
uv run pytest -q
# Drop testdb from the hull group; volume stays for the next run.
compose stop testdb
compose rm -f testdb
echo "TEST_OK"
