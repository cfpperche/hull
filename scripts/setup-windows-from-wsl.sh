#!/usr/bin/env bash
# From WSL: pop a Windows UAC prompt and configure hosts + Hull CA.
#   ./scripts/setup-windows-from-wsl.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${HULL_HOST:-hull.test}"
PS1="$ROOT/scripts/setup-windows.ps1"
CA="$ROOT/deploy/certs/ca/ca.crt"

if ! grep -qi microsoft /proc/version 2>/dev/null; then
  echo "ERROR: this script is for WSL. On native Windows run setup-windows.ps1 as Admin." >&2
  exit 1
fi

[[ -f "$CA" ]] || "$ROOT/scripts/generate-certs.sh"

PWSH=""
for c in \
  powershell.exe \
  /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe
 do
  if command -v "$c" >/dev/null 2>&1 || [[ -x "$c" ]]; then
    PWSH="$c"
    break
  fi
done
[[ -n "$PWSH" ]] || { echo "ERROR: powershell.exe not found (WSL interop?)" >&2; exit 1; }

WIN_PS1=$(wslpath -w "$PS1")
WIN_CA=$(wslpath -w "$CA")

echo "Approve the Windows UAC prompt (hosts + Hull CA)."
"$PWSH" -NoProfile -Command \
  "Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${WIN_PS1}','-CaPath','${WIN_CA}','-HostName','${HOST}'"

echo "If UAC was approved:  https://${HOST}/  https://app.${HOST}/  https://admin.${HOST}/  https://mail.${HOST}/"
