#!/usr/bin/env bash
# The browser gate. `.github/workflows/ci.yml` calls this and nothing else.
#
# Locally:  make ci-e2e
#
# Kept separate from ci.sh because it stands up the whole stack: the fast checks
# should not wait on compose, and this one is slow enough to want to run alone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

step() { echo; echo "── $* ─────────────────────────────────────────"; }

HOST="${HULL_HOST:-hull.test}"

step "install (locked)"
pnpm install --frozen-lockfile

# On a workstation these already exist, from setup-local.sh. On a fresh runner
# they do not, and Traefik routes by Host — without them every request 404s.
if [[ -n "${CI:-}" ]]; then
  step "resolve the Hull hostnames"
  sudo tee -a /etc/hosts >/dev/null <<EOF
127.0.0.1 ${HOST} www.${HOST} app.${HOST} admin.${HOST}
127.0.0.1 mail.${HOST} s3.${HOST} rustfs.${HOST} db.${HOST}
EOF
elif ! getent hosts "app.${HOST}" >/dev/null 2>&1; then
  echo "ERROR: app.${HOST} does not resolve. Run: sudo ./scripts/setup-local.sh" >&2
  exit 1
fi

[[ -f .env ]] || cp .env.example .env

# Anonymous registry pulls are rate-limited per source IP and CI runners share
# them, so a cold run can die on "Rate exceeded" before a single test runs — a
# red build that says nothing about the code. Locally the images are cached.
if [[ -n "${CI:-}" ]]; then
  step "pull base images with backoff"
  images=$(docker compose --env-file .env -f deploy/compose.yaml -p hull config --images \
           | sort -u | grep -v '^hull-')
  for img in $images; do
    for attempt in 1 2 3 4 5; do
      if docker pull -q "$img" >/dev/null; then break; fi
      if [[ "$attempt" == 5 ]]; then echo "giving up on $img" >&2; exit 1; fi
      echo "retry $attempt for $img"
      sleep $((attempt * 20))
    done
  done
fi

step "bring up the stack"
"$ROOT/scripts/up.sh"

step "browser"
# --with-deps needs root for system libraries; a workstation already has them.
if [[ -n "${CI:-}" ]]; then
  pnpm --filter @hull/e2e exec playwright install --with-deps chromium
else
  pnpm --filter @hull/e2e exec playwright install chromium
fi

step "end to end"
pnpm e2e

echo
echo "CI_E2E_OK"
