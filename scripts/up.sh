#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[[ -f .env ]] || cp .env.example .env
. "$ROOT/scripts/lib/env.sh"
hull_load_env "$ROOT/.env"
HOST="${HULL_HOST:-hull.test}"

"$ROOT/scripts/check-deps.sh" up
"$ROOT/scripts/generate-certs.sh"
"$ROOT/scripts/render-edge.sh" prod
"$ROOT/scripts/render-brand.sh"
"$ROOT/scripts/preflight.sh"

# Always rebuild: the tags are pinned at :0.1.0 forever, so "build only when the
# tag is missing" meant every run after the first served the first build — and
# the visual harness then judged pixels from stale code. Layer caching keeps a
# no-op rebuild cheap.
"$ROOT/scripts/build-images.sh"

compose() {
  docker compose --env-file "$ROOT/.env" -f "$ROOT/deploy/compose.yaml" -p hull "$@"
}

compose up -d postgres rustfs mailpit
# Probe over TCP, not the unix socket: initdb runs a socket-only temp server, so
# a socket probe goes green while nothing is listening on 5432 yet and migrate
# then fails with "connection refused". Require consecutive successes.
echo -n "waiting for postgres"
ready=0
for _ in $(seq 1 60); do
  if docker exec hull-pg pg_isready -h 127.0.0.1 -U "${HULL_POSTGRES_USER:-hull}" -d "${HULL_POSTGRES_DB:-hull}" >/dev/null 2>&1; then
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
if [[ "$ready" -lt 3 ]]; then
  echo " FAIL"
  echo "ERROR: postgres did not become ready" >&2
  exit 1
fi

compose --profile tools run --rm migrate
# migrate is profile tools — do not `up` it or it sits Exited in the hull group
compose up -d --remove-orphans

# `compose up -d` returns when containers start, not when they serve. up.sh used
# to print UP_OK and point at smoke.sh, which then failed on health because the
# API was still booting behind a freshly reloaded edge.
echo -n "waiting for the edge"
ready=0
for _ in $(seq 1 60); do
  if curl -sk --max-time 2 --resolve "app.${HOST}:443:127.0.0.1" \
       "https://app.${HOST}/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
    ready=1
    echo " ok"
    break
  fi
  echo -n "."
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo " FAIL"
  echo "ERROR: https://app.${HOST}/api/health did not answer. Check: docker logs hull-api" >&2
  exit 1
fi

echo "UP_OK  https://${HOST}/  https://app.${HOST}/  https://admin.${HOST}/"
echo "Lab: ada@${HOST} / demodemo1   admin@${HOST} / same"
echo "Mail: https://mail.${HOST}/"
