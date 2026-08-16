#!/usr/bin/env bash
set -euo pipefail
mode="${1:-up}"
missing=()

need() {
  command -v "$1" >/dev/null 2>&1 || missing+=("$1")
}

need docker
need openssl
if ! docker compose version >/dev/null 2>&1; then
  missing+=("docker compose")
fi

if [[ "$mode" == "dev" ]]; then
  need node
  need pnpm
  need uv
fi

if ((${#missing[@]})); then
  echo "ERROR: missing: ${missing[*]}" >&2
  echo "Install Docker Engine + Compose v2, and openssl. For ./scripts/dev.sh also Node 20+, pnpm, and uv." >&2
  exit 1
fi
echo "DEPS_OK mode=${mode}"
