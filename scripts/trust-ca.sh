#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CA="$ROOT/deploy/certs/ca/ca.crt"
[[ -f "$CA" ]] || { echo "ERROR: missing $CA — run scripts/generate-certs.sh first" >&2; exit 1; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run with sudo to install the Hull CA:"
  echo "  sudo $0"
  exit 1
fi

if [[ -d /usr/local/share/ca-certificates ]]; then
  install -m 0644 "$CA" /usr/local/share/ca-certificates/hull-local-ca.crt
  update-ca-certificates
  echo "TRUST_OK debian/ubuntu"
  exit 0
fi

if command -v update-ca-trust >/dev/null && [[ -d /etc/pki/ca-trust/source/anchors ]]; then
  install -m 0644 "$CA" /etc/pki/ca-trust/source/anchors/hull-local-ca.crt
  update-ca-trust extract
  echo "TRUST_OK fedora/rhel"
  exit 0
fi

echo "ERROR: unknown trust store. Import $CA in the browser as an authority." >&2
exit 1
