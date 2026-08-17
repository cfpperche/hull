#!/usr/bin/env bash
# Put this lab back to the demo fixture, without tearing the stack down.
#
#   ./scripts/reset-lab.sh      (or: make reset)
#
# `migrate.sh` cannot do this. Its seed inserts `WHERE NOT EXISTS` and is recorded
# in schema_seeds, so it *creates* the fixture when it is missing and does nothing
# once it exists — change ada's password and re-running migrate is a no-op.
#
# The alternative was `down.sh -v && up.sh`: correct, but it drops the volumes and
# rebuilds every image to undo one changed password. This keeps the containers,
# the images and the certificates, and only puts the data back.
#
# Every layer that touches the lab is included, because a half reset is worse than
# none — you stop trusting it and go back to the sledgehammer anyway. That means
# Postgres, Mailpit's inbox, and the avatar bucket.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
. "$ROOT/scripts/lib/env.sh"
hull_load_env "$ROOT/.env"

HOST="${HULL_HOST:-hull.test}"
SEED="${HULL_SEED_DEMO:-1}"

compose() {
  docker compose --env-file "$ROOT/.env" -f "$ROOT/deploy/compose.yaml" -p hull "$@"
}

# Same refusal migrate.sh makes, for the same reason: the fixture plants a
# platform_admin whose password is printed in the README. On a real install this
# script would delete the customer's data and hand out a known admin login.
if [[ "$HOST" != *.test ]]; then
  echo "ERROR: refusing on host '${HOST}', which is not a .test lab apex." >&2
  echo "       This deletes every row and re-installs a publicly known admin login." >&2
  exit 1
fi
if [[ "$SEED" != "1" ]]; then
  echo "ERROR: HULL_SEED_DEMO=0 — there is no demo fixture to reset to." >&2
  exit 1
fi

if ! compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "ERROR: postgres is not running. Start the stack first: ./scripts/up.sh" >&2
  exit 1
fi

echo "Resetting the ${HOST} lab to the demo fixture."

# ── 1. the database ─────────────────────────────────────────────────────────
# Every table except schema_migrations, discovered rather than listed: a reset
# that silently misses a table added later is the kind of guard this repo keeps
# finding after it has already lied. schema_seeds goes with them, which is what
# makes the seed apply again on the next migrate.
echo -n "  tables… "
compose exec -T postgres psql -v ON_ERROR_STOP=1 -X -q \
  -U "${HULL_POSTGRES_USER:-hull}" -d "${HULL_POSTGRES_DB:-hull}" <<'SQL'
DO $$
DECLARE
    victims text;
BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
      INTO victims
      FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename <> 'schema_migrations';
    IF victims IS NULL THEN
        RAISE EXCEPTION 'no tables found — is the schema applied?';
    END IF;
    EXECUTE 'TRUNCATE TABLE ' || victims || ' RESTART IDENTITY CASCADE';
END $$;
SQL
echo "truncated"

echo -n "  fixture… "
# Compose narrates container lifecycle on stderr, so a plain >/dev/null still
# prints six lines mid-sentence. Hold it and show it only if migrate fails.
if ! seed_log=$(compose --profile tools run --rm migrate 2>&1); then
  echo "FAILED"
  echo "$seed_log" >&2
  exit 1
fi
echo "seeded"

# ── 2. the inbox ────────────────────────────────────────────────────────────
# Left alone, yesterday's reset link is still the newest mail for an address the
# fixture just recreated, and both `qa.sh mail` and the e2e helper would hand it
# to a caller as if it were fresh.
echo -n "  inbox… "
if curl -sk --max-time 5 -X DELETE "https://mail.${HOST}/api/v1/messages" >/dev/null 2>&1; then
  echo "cleared"
else
  echo "skipped (mailpit did not answer)"
fi

# ── 3. the avatars ──────────────────────────────────────────────────────────
# The seeded users have fixed UUIDs, so an object left behind belongs to the same
# key the next ada would write to. It is unreachable while her row carries no
# avatar_key, but "unreachable" is not "gone" and this is meant to be a reset.
echo -n "  avatars… "
if compose exec -T api python - <<'PY' 2>/dev/null
from hull_fastapi.config import Settings
from hull_fastapi.storage import s3_client, s3_enabled

settings = Settings()
if not s3_enabled(settings):
    raise SystemExit(0)
client = s3_client(settings)
bucket = settings.s3_bucket_avatars
pages = client.get_paginator("list_objects_v2").paginate(Bucket=bucket)
keys = [{"Key": o["Key"]} for page in pages for o in page.get("Contents", [])]
for i in range(0, len(keys), 1000):
    client.delete_objects(Bucket=bucket, Delete={"Objects": keys[i : i + 1000]})
PY
then
  echo "cleared"
else
  echo "skipped (api or object store did not answer)"
fi

echo
echo "RESET_OK  ${HOST} is back to the fixture"
echo "  ada@${HOST} / demodemo1       admin@${HOST} / demodemo1"
