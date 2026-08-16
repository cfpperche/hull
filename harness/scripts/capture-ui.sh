#!/usr/bin/env bash
# Capture www / web / admin for visual review (agent-browser).
# One `batch` per surface so viewport/screenshot cannot spawn a blank browser.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[[ -f "$ROOT/.env" ]] && set -a && source "$ROOT/.env" && set +a
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

echo "capture web home (ada)"
agent-browser batch --bail \
  "set viewport 1440 900" \
  "find testid auth-email fill ada@${HOST}" \
  "find testid auth-password fill demodemo1" \
  "find testid auth-submit click" \
  "wait --load networkidle" \
  "screenshot ${OUT}/web-home-desktop.png"
agent-browser screenshot --annotate "${OUT}/web-home-desktop-ann.png"

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

agent-browser close --all >/dev/null 2>&1 || true

echo "VISUAL_OK"
ls -l "$OUT"/*.png
echo "Read those PNGs with the file reader before judging UI."
