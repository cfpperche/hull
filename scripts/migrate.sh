#!/usr/bin/env bash
# Apply schema/migrations (and optional seed) with psql. No API package.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -d /schema ]]; then
  SCHEMA=/schema
else
  SCHEMA="${HULL_SCHEMA_DIR:-$ROOT/schema}"
fi

SEED="${HULL_SEED_DEMO:-1}"

psql_exec() {
  if [[ -n "${HULL_PG_CONTAINER:-}" ]]; then
    docker exec -i \
      -e PGUSER="${PGUSER:-hull}" \
      -e PGPASSWORD="${PGPASSWORD:-hull}" \
      -e PGDATABASE="${PGDATABASE:-hull}" \
      -e PGHOST=127.0.0.1 \
      "$HULL_PG_CONTAINER" \
      psql -v ON_ERROR_STOP=1 -X -q "$@"
    return
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo "ERROR: psql not on PATH and HULL_PG_CONTAINER is unset" >&2
    exit 1
  fi
  if [[ -n "${HULL_DATABASE_URL:-}" ]]; then
    psql -v ON_ERROR_STOP=1 -X -q "$HULL_DATABASE_URL" "$@"
    return
  fi
  psql -v ON_ERROR_STOP=1 -X -q "$@"
}

export PGUSER="${PGUSER:-${HULL_POSTGRES_USER:-hull}}"
export PGPASSWORD="${PGPASSWORD:-${HULL_POSTGRES_PASSWORD:-hull}}"
export PGDATABASE="${PGDATABASE:-${HULL_POSTGRES_DB:-hull}}"
export PGHOST="${PGHOST:-${HULL_PGHOST:-}}"
export PGPORT="${PGPORT:-${HULL_PG_PORT:-}}"

psql_exec <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS schema_seeds (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

apply_dir() {
  local dir="$1"
  local table="$2"
  local f base
  for f in "$dir"/*.sql; do
    [[ -e "$f" ]] || continue
    base="$(basename "$f")"
    already="$(psql_exec -tAc "SELECT 1 FROM ${table} WHERE id = '${base}'" | tr -d '[:space:]')"
    if [[ "$already" == "1" ]]; then
      echo "skip  ${base}"
      continue
    fi
    echo "apply ${base}"
    psql_exec -f "$f"
    psql_exec -c "INSERT INTO ${table} (id) VALUES ('${base}')"
  done
}

if [[ -n "${HULL_PG_CONTAINER:-}" ]]; then
  # Files live on the host; pipe into the container's psql.
  apply_dir_docker() {
    local dir="$1"
    local table="$2"
    local f base
    for f in "$dir"/*.sql; do
      [[ -e "$f" ]] || continue
      base="$(basename "$f")"
      already="$(psql_exec -tAc "SELECT 1 FROM ${table} WHERE id = '${base}'" | tr -d '[:space:]')"
      if [[ "$already" == "1" ]]; then
        echo "skip  ${base}"
        continue
      fi
      echo "apply ${base}"
      docker exec -i \
        -e PGUSER="${PGUSER}" \
        -e PGPASSWORD="${PGPASSWORD}" \
        -e PGDATABASE="${PGDATABASE}" \
        -e PGHOST=127.0.0.1 \
        "$HULL_PG_CONTAINER" \
        psql -v ON_ERROR_STOP=1 -X -q <"$f"
      psql_exec -c "INSERT INTO ${table} (id) VALUES ('${base}')"
    done
  }
  apply_dir_docker "$SCHEMA/migrations" schema_migrations
  if [[ "$SEED" == "1" ]]; then
    apply_dir_docker "$SCHEMA/seed" schema_seeds
  fi
else
  apply_dir "$SCHEMA/migrations" schema_migrations
  if [[ "$SEED" == "1" ]]; then
    apply_dir "$SCHEMA/seed" schema_seeds
  fi
fi

echo "MIGRATE_OK schema=${SCHEMA} seed=${SEED}"
