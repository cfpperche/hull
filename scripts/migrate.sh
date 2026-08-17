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
SEED_HOST="${HULL_HOST:-hull.test}"
SEED_HOST_SQL="$(printf '%s' "$SEED_HOST" | sed "s/'/''/g")"

# The demo seed installs a platform_admin whose password is printed in the README.
# That is fine for a .test lab and a disaster anywhere else, so refuse rather than
# rely on the operator remembering to flip the flag.
if [[ "$SEED" == "1" && "$SEED_HOST" != *.test ]]; then
  echo "ERROR: HULL_SEED_DEMO=1 seeds a platform_admin with a publicly known password." >&2
  echo "       Refusing on host '${SEED_HOST}', which is not a .test lab apex." >&2
  echo "       Set HULL_SEED_DEMO=0 for this install." >&2
  exit 1
fi

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

already_applied() {
  local table="$1" id="$2"
  psql_exec -tAc "SELECT 1 FROM ${table} WHERE id = '${id}'" | tr -d '[:space:]'
}

pipe_sql() {
  # --single-transaction: DDL is transactional in Postgres, so a file and its
  # tracking row either both land or neither does.
  if [[ -n "${HULL_PG_CONTAINER:-}" ]]; then
    docker exec -i \
      -e PGUSER="${PGUSER}" \
      -e PGPASSWORD="${PGPASSWORD}" \
      -e PGDATABASE="${PGDATABASE}" \
      -e PGHOST=127.0.0.1 \
      "$HULL_PG_CONTAINER" \
      psql -v ON_ERROR_STOP=1 --single-transaction -X -q
  elif [[ -n "${HULL_DATABASE_URL:-}" ]]; then
    psql -v ON_ERROR_STOP=1 --single-transaction -X -q "$HULL_DATABASE_URL"
  else
    psql -v ON_ERROR_STOP=1 --single-transaction -X -q
  fi
}

apply_sql_file() {
  local table="$1" id="$2" file="$3"
  if [[ "$(already_applied "$table" "$id")" == "1" ]]; then
    echo "skip  ${id}"
    return
  fi
  echo "apply ${id}"
  # One transaction for the file plus its bookkeeping. Previously a mid-file
  # failure committed the earlier statements and recorded nothing, so the next
  # run died on "already exists" and up.sh could never get past migrate.
  # The advisory lock serialises concurrent runners on the same file.
  {
    # PERFORM inside DO, not a bare SELECT — a SELECT prints its result table
    # into the migrate output for every file applied.
    printf "DO \$mig\$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('hull-migrate'), hashtext('%s')); END \$mig\$;\n" "$id"
    cat "$file"
    printf "\nINSERT INTO %s (id) VALUES ('%s');\n" "$table" "$id"
  } | pipe_sql
}

apply_sql_dir() {
  local dir="$1" table="$2" f base
  for f in "$dir"/*.sql; do
    [[ -e "$f" ]] || continue
    apply_sql_file "$table" "$(basename "$f")" "$f"
  done
}

apply_seed_tmpls() {
  local dir="$SCHEMA/seed" f id tmp
  for f in "$dir"/*.sql.tmpl; do
    [[ -e "$f" ]] || continue
    id="$(basename "$f" .tmpl)"
    tmp="$(mktemp)"
    sed "s/__HOST__/${SEED_HOST_SQL}/g" "$f" >"$tmp"
    apply_sql_file schema_seeds "$id" "$tmp"
    rm -f "$tmp"
  done
}

apply_sql_dir "$SCHEMA/migrations" schema_migrations
if [[ "$SEED" == "1" ]]; then
  apply_sql_dir "$SCHEMA/seed" schema_seeds
  apply_seed_tmpls
fi

echo "MIGRATE_OK schema=${SCHEMA} seed=${SEED} host=${SEED_HOST}"
