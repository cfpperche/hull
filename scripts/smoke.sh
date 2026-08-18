#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/scripts/lib/env.sh"
hull_load_env "$ROOT/.env"
HOST="${HULL_HOST:-hull.test}"
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
# mktemp, not a fixed /tmp path: a predictable name is a symlink target on any
# shared box or CI runner.
resp=$(mktemp)
trap 'rm -f "$jar_a" "$jar_b" "$resp"' EXIT

# The product is closed until the address is confirmed, so the smoke has to go
# through the inbox like anybody else. That is a gain rather than a tax: this
# path now proves SMTP delivery and the verify endpoint as a side effect, neither
# of which the smoke covered before. Deliberately no shortcut through psql — a
# check that lets itself in the back door stops describing the install.
confirm() {
  local email="$1" id="" link="" body=""
  for _ in $(seq 1 40); do
    # Mailpit's search takes `to:`, which is enough: every address here carries
    # this run's timestamp, so there is nothing else to collide with.
    id=$(curl -fsS -k -G "https://mail.${HOST}/api/v1/search" \
      --data-urlencode "query=to:${email}" 2>/dev/null \
      | sed -n 's/.*"ID":"\([^"]*\)".*/\1/p' | head -1) || true
    if [[ -n "$id" ]]; then
      body=$(curl -fsS -k "https://mail.${HOST}/api/v1/message/${id}" 2>/dev/null) || true
      link=$(printf '%s' "$body" | grep -o "https://[^\" ]*/verify#[A-Za-z0-9_-]*" | head -1) || true
      [[ -n "$link" ]] && break
    fi
    sleep 0.25
  done
  [[ -n "$link" ]] || fail "no confirmation mail for ${email}"
  # The token is the fragment, which never reaches a server — so the smoke has
  # to post it the way the page does rather than following the URL.
  curl -fsS -H 'content-type: application/json' \
    -d "{\"token\":\"${link##*#}\"}" "${APP}/api/v1/auth/verify" >/dev/null \
    || fail "verify ${email}"
}

signup() {
  local jar="$1" email="$2"
  curl -fsS -c "$jar" -b "$jar" -H 'content-type: application/json' \
    -d "{\"email\":\"${email}\",\"password\":\"demodemo1\"}" \
    "${APP}/api/v1/auth/signup" >/dev/null
}

signup "$jar_a" "$a_email"
confirm "$a_email"
org=$(curl -fsS -c "$jar_a" -b "$jar_a" -H 'content-type: application/json' \
  -d "{\"name\":\"Smoke ${uniq}\"}" "${APP}/api/v1/orgs")
org_id=$(printf '%s' "$org" | sed -n 's/.*"org":{"id":"\([^"]*\)".*/\1/p')
[[ -n "$org_id" ]] || fail "create org"

# Positive control first: without it a 404 from a renamed or unrouted endpoint
# would read as "isolation verified" when the request never reached switch_org.
own=$(curl -sS -o /dev/null -w '%{http_code}' -c "$jar_a" -b "$jar_a" \
  -H 'content-type: application/json' \
  -d "{\"id\":\"${org_id}\"}" "${APP}/api/v1/session/org")
[[ "$own" == "200" ]] || fail "switch to own org expected 200 got ${own}"

signup "$jar_b" "$b_email"
confirm "$b_email"
body=$(curl -sS -o "$resp" -w '%{http_code}' -c "$jar_b" -b "$jar_b" \
  -H 'content-type: application/json' \
  -d "{\"id\":\"${org_id}\"}" "${APP}/api/v1/session/org")
[[ "$body" == "404" ]] || fail "isolation expected 404 got ${body}"
# Assert on the reason_code too, so a generic catch-all 404 cannot pass for the
# account-level not_found that switch_org actually emits.
grep -q '"reason_code":"not_found"' "$resp" || fail "isolation 404 was not switch_org's not_found"

echo "SMOKE_OK  www + health + signup + mail + verify + org switch + org isolation"
