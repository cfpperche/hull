#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[[ -f "$ROOT/.env" ]] && set -a && source "$ROOT/.env" && set +a
HOST="${HULL_HOST:-hull.dev}"
WWW="https://${HOST}"
APP="https://app.${HOST}"
uniq="s$(date +%s)"

fail() { echo "SMOKE_FAIL $*" >&2; exit 1; }

curl -fsS "${WWW}/" >/dev/null || fail "www"
curl -fsS "${APP}/api/health" | grep -q '"status":"ok"' || fail "health"

a_email="ada-${uniq}@${HOST}"
b_email="bob-${uniq}@${HOST}"
jar_a=$(mktemp)
jar_b=$(mktemp)
trap 'rm -f "$jar_a" "$jar_b"' EXIT

signup() {
  local jar="$1" user="$2" email="$3"
  curl -fsS -c "$jar" -b "$jar" -H 'content-type: application/json' \
    -d "{\"username\":\"${user}\",\"email\":\"${email}\",\"password\":\"demodemo1\"}" \
    "${APP}/api/v1/auth/signup" >/dev/null
}

signup "$jar_a" "a${uniq}" "$a_email"
org=$(curl -fsS -c "$jar_a" -b "$jar_a" -H 'content-type: application/json' \
  -d "{\"name\":\"Smoke ${uniq}\"}" "${APP}/api/v1/orgs")
org_id=$(printf '%s' "$org" | sed -n 's/.*"org":{"id":"\([^"]*\)".*/\1/p')
[[ -n "$org_id" ]] || fail "create org"

signup "$jar_b" "b${uniq}" "$b_email"
code=$(curl -sS -o /tmp/hull-smoke-b.json -w '%{http_code}' -c "$jar_b" -b "$jar_b" \
  -H 'content-type: application/json' \
  -d "{\"id\":\"${org_id}\"}" "${APP}/api/v1/session/org")
[[ "$code" == "404" ]] || fail "isolation expected 404 got ${code}"

echo "SMOKE_OK  www + health + signup + org isolation"
