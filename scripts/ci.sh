#!/usr/bin/env bash
# The gate. `.github/workflows/ci.yml` calls this and nothing else, so "did I run
# what CI runs" is never a guess and the two cannot drift.
#
# Locally:  make ci
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

step() { echo; echo "── $* ─────────────────────────────────────────"; }

step "install (locked)"
pnpm install --frozen-lockfile

step "typecheck"
pnpm typecheck

step "build the three surfaces"
for app in www web admin; do
  pnpm --filter "@hull/${app}" build
done

# The frontend Dockerfile hardcodes the workspace importer list. Nothing else
# exercises it, so an eighth package would break image builds only at `up.sh`.
step "build one frontend image (catches importer-list drift)"
docker build -f deploy/docker/frontend.Dockerfile --build-arg SHELL=web -t hull-web:ci .

step "lint, format, adapter tests"
"$ROOT/scripts/test.sh"

echo
echo "CI_OK  typecheck + builds + image + ruff + pytest"
echo "Browser end-to-end is a separate gate: make ci-e2e"
