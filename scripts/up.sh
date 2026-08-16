#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[[ -f .env ]] || cp .env.example .env
set -a && source .env && set +a
HOST="${HULL_HOST:-hull.test}"

"$ROOT/scripts/check-deps.sh" up
"$ROOT/scripts/generate-certs.sh"
"$ROOT/scripts/render-edge.sh" prod
"$ROOT/scripts/render-brand.sh"
"$ROOT/scripts/preflight.sh"

need_build=0
for img in hull-api:0.1.0 hull-www:0.1.0 hull-web:0.1.0 hull-admin:0.1.0; do
  docker image inspect "$img" >/dev/null 2>&1 || need_build=1
done
if [[ "$need_build" == "1" ]]; then
  "$ROOT/scripts/build-images.sh"
fi

compose() {
  docker compose --env-file "$ROOT/.env" -f "$ROOT/deploy/compose.yaml" -p hull "$@"
}

compose up -d postgres rustfs mailpit
echo -n "waiting for postgres"
for _ in $(seq 1 40); do
  if docker exec hull-pg pg_isready -U "${HULL_POSTGRES_USER:-hull}" >/dev/null 2>&1; then
    echo " ok"
    break
  fi
  echo -n "."
  sleep 0.5
done

compose run --rm migrate
compose up -d --remove-orphans
echo "UP_OK  https://${HOST}/  https://app.${HOST}/  https://admin.${HOST}/"
echo "Lab: ada@${HOST} / demodemo1   admin@${HOST} / same"
echo "Mail: https://mail.${HOST}/"
