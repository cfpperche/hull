#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/check-deps.sh" up

name="hull-test-pg"
port="${HULL_TEST_PG_PORT:-55434}"
if ! docker ps --format '{{.Names}}' | grep -qx "$name"; then
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -d --name "$name" \
    -e POSTGRES_USER=hull -e POSTGRES_PASSWORD=hull -e POSTGRES_DB=hull_test \
    -p "127.0.0.1:${port}:5432" \
    public.ecr.aws/docker/library/postgres:16 >/dev/null
  echo -n "waiting for ${name}"
  for _ in $(seq 1 40); do
    if docker exec "$name" pg_isready -U hull -d hull_test >/dev/null 2>&1; then
      echo " ok"
      break
    fi
    echo -n "."
    sleep 0.5
  done
fi

export HULL_DATABASE_URL="postgresql://hull:hull@127.0.0.1:${port}/hull_test"
cd "$ROOT/api"
uv sync --extra dev
uv run pytest -q
echo "TEST_OK"
