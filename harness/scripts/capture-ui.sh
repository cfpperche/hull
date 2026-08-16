#!/usr/bin/env bash
# Capture www / web / admin for visual review (agent-browser).
# One `batch` per surface so viewport/screenshot cannot spawn a blank browser.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
. "$ROOT/scripts/lib/env.sh"
hull_load_env "$ROOT/.env"
HOST="${HULL_HOST:-hull.test}"
OUT="${VISUAL_OUT:-$ROOT/harness/visual/current}"
export AGENT_BROWSER_SESSION="hull-visual-$$"
export AGENT_BROWSER_IGNORE_HTTPS_ERRORS=1

mkdir -p "$OUT"

if ! command -v agent-browser >/dev/null; then
  echo "ERROR: agent-browser missing. npm install -g agent-browser && agent-browser install" >&2
  exit 1
fi

probe() {
  local url="$1" code
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 \
    --resolve "${HOST}:443:127.0.0.1" \
    --resolve "app.${HOST}:443:127.0.0.1" \
    --resolve "admin.${HOST}:443:127.0.0.1" \
    "$url" || true)
  if [[ "$code" != "200" && "$code" != "304" ]]; then
    echo "ERROR: $url → HTTP ${code:-000}. Start the stack: ./scripts/up.sh" >&2
    exit 1
  fi
}

# Assert out-of-band, not inside a batch: `agent-browser` exits 0 even when a
# step fails, so an in-batch check cannot fail this script — and `find` activates
# what it matches, so asserting on a control has side effects (pointing it at the
# sign-out button signed the session out and every later PNG was the login page).
signed_in_or_die() {
  local label="$1" sel="$2" out
  out=$(agent-browser eval "!!document.querySelector('${sel}')" 2>/dev/null || true)
  if [[ "$out" != *true* ]]; then
    echo "ERROR: ${label} is not signed in (no ${sel} in the page)." >&2
    echo "       Every later screenshot would be the sign-in page. Is the lab seed applied (HULL_SEED_DEMO=1)?" >&2
    exit 1
  fi
}

probe "https://${HOST}/"
probe "https://app.${HOST}/"
probe "https://admin.${HOST}/"

agent-browser close --all >/dev/null 2>&1 || true

echo "capture www"
agent-browser batch --bail \
  "open https://${HOST}/" \
  "wait --load networkidle" \
  "set viewport 1440 900" \
  "screenshot ${OUT}/www-desktop.png" \
  "set viewport 390 844" \
  "screenshot ${OUT}/www-mobile.png"

echo "capture web signin"
agent-browser batch --bail \
  "open https://app.${HOST}/signin" \
  "wait --load networkidle" \
  "set viewport 1440 900" \
  "screenshot ${OUT}/web-signin-desktop.png" \
  "set viewport 390 844" \
  "screenshot ${OUT}/web-signin-mobile.png"

echo "capture web signup"
agent-browser batch --bail \
  "open https://app.${HOST}/signup" \
  "wait --load networkidle" \
  "set viewport 1440 900" \
  "screenshot ${OUT}/web-signup-desktop.png"

# The `find testid` steps after each sign-in are assertions, not captures: with
# --bail they fail the run. Without them a failed sign-in (HULL_SEED_DEMO=0, or a
# wiped volume) still printed VISUAL_OK over six screenshots of the login page
# filed under the names of the signed-in surfaces.
echo "capture web home (ada)"
agent-browser batch --bail \
  "open https://app.${HOST}/signin" \
  "wait --load networkidle" \
  "set viewport 1440 900" \
  "find testid auth-email fill ada@${HOST}" \
  "find testid auth-password fill demodemo1" \
  "find testid auth-submit click" \
  "wait --load networkidle" \
  "screenshot ${OUT}/web-home-desktop.png"
signed_in_or_die "app.${HOST}" "[data-testid=user-menu]"
agent-browser screenshot --annotate "${OUT}/web-home-desktop-ann.png"

echo "capture web account"
agent-browser batch --bail \
  "open https://app.${HOST}/account" \
  "wait --load networkidle" \
  "screenshot ${OUT}/web-account-desktop.png"

echo "capture admin"
# Cookie is on .${HOST}; Ada's session would bounce admin → app.
agent-browser cookies clear
agent-browser batch --bail \
  "open https://admin.${HOST}/" \
  "wait --load networkidle" \
  "set viewport 1440 900" \
  "screenshot ${OUT}/admin-signin-desktop.png" \
  "find testid auth-email fill admin@${HOST}" \
  "find testid auth-password fill demodemo1" \
  "find testid auth-submit click" \
  "wait --load networkidle" \
  "screenshot ${OUT}/admin-home-desktop.png"

signed_in_or_die "admin.${HOST}" "[data-testid=sign-out]"

echo "capture admin users + orgs"
agent-browser batch --bail \
  "open https://admin.${HOST}/users" \
  "wait --load networkidle" \
  "screenshot ${OUT}/admin-users-desktop.png" \
  "open https://admin.${HOST}/orgs" \
  "wait --load networkidle" \
  "screenshot ${OUT}/admin-orgs-desktop.png"

agent-browser close --all >/dev/null 2>&1 || true

echo "VISUAL_OK"
ls -l "$OUT"/*.png
echo "Read those PNGs with the file reader before judging UI."
