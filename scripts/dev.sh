#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[[ -f .env ]] || cp .env.example .env
set -a && source .env && set +a
HOST="${HULL_HOST:-hull.test}"

"$ROOT/scripts/check-deps.sh" dev
"$ROOT/scripts/generate-certs.sh"
"$ROOT/scripts/render-edge.sh" dev
"$ROOT/scripts/render-brand.sh"
"$ROOT/scripts/preflight.sh"

compose() {
  docker compose --env-file "$ROOT/.env" \
    -f "$ROOT/deploy/compose.yaml" \
    -f "$ROOT/deploy/compose.dev.yaml" \
    -p hull "$@"
}

compose up -d postgres rustfs mailpit traefik
echo -n "waiting for postgres"
for _ in $(seq 1 40); do
  if docker exec hull-pg pg_isready -U "${HULL_POSTGRES_USER:-hull}" >/dev/null 2>&1; then
    echo " ok"
    break
  fi
  echo -n "."
  sleep 0.5
done

export HULL_DATABASE_URL="postgresql://${HULL_POSTGRES_USER:-hull}:${HULL_POSTGRES_PASSWORD:-hull}@127.0.0.1:${HULL_PG_PORT:-5432}/${HULL_POSTGRES_DB:-hull}"
export HULL_SMTP_HOST=127.0.0.1
export HULL_SMTP_PORT=1025
export HULL_S3_ENDPOINT=http://127.0.0.1:9000
export HULL_PUBLIC_ORIGIN="https://app.${HOST}"
export HULL_SEED_DEMO="${HULL_SEED_DEMO:-1}"

# RustFS S3 is not published on the host in product compose. For inner loop
# the API on the host needs it — publish via a one-off note:
# talk to rustfs through `docker exec` is not an HTTP client. Map 9000.
if ! ss -ltn 2>/dev/null | grep -qE "127\\.0\\.0\\.1:9000\\s"; then
  echo "NOTE: S3 is only on the Docker network. Avatar upload in inner loop needs a published 9000 or leave HULL_S3_ENDPOINT empty."
  unset HULL_S3_ENDPOINT || true
fi

HULL_PG_CONTAINER=hull-pg \
  PGUSER="${HULL_POSTGRES_USER:-hull}" \
  PGPASSWORD="${HULL_POSTGRES_PASSWORD:-hull}" \
  PGDATABASE="${HULL_POSTGRES_DB:-hull}" \
  HULL_SEED_DEMO="${HULL_SEED_DEMO:-1}" \
  "$ROOT/scripts/migrate.sh"

echo
echo "DEV_OK  start these in other terminals:"
echo "  cd $ROOT/api && uv run hull-api"
echo "  cd $ROOT && pnpm install && pnpm dev:www && pnpm dev:web && pnpm dev:admin"
echo "https://${HOST}/  https://app.${HOST}/  https://admin.${HOST}/"
