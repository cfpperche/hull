#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "building hull-api:0.1.0"
docker build -t hull-api:0.1.0 -f "$ROOT/api/Dockerfile" "$ROOT/api"

for shell in www web admin; do
  echo "building hull-${shell}:0.1.0"
  docker build \
    -t "hull-${shell}:0.1.0" \
    -f "$ROOT/deploy/docker/frontend.Dockerfile" \
    --build-arg "SHELL=${shell}" \
    "$ROOT"
done
echo "IMAGES_OK hull-api hull-www hull-web hull-admin"
