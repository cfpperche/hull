# Run elevated (Administrator). Adds hull.test (+ app/admin/www/mail) to Windows hosts and trusts Hull CA.
# Elevated UAC often cannot read \\wsl$\...\edge-hosts.txt — required names are hardcoded.
# Traefik publishes 127.0.0.1:443 only — never write ::1 (WSL does not forward Windows IPv6 loopback).
param(
    [string]$HostName = $(if ($env:HULL_HOST) { $env:HULL_HOST } else { "hull.test" }),
    [string]$CaPath = ""
)

$ErrorActionPreference = "Stop"
$HostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
$NamesFile = Join-Path $PSScriptRoot "..\deploy\edge-hosts.txt"
$Names = New-Object System.Collections.Generic.List[string]
foreach ($n in @(
    $HostName,
    "www.$HostName",
    "app.$HostName",
    "admin.$HostName",
    "mail.$HostName",
    "s3.$HostName",
    "rustfs.$HostName",
    "db.$HostName"
)) {
    if ($n) { [void]$Names.Add($n) }
}
if (Test-Path $NamesFile) {
    Get-Content $NamesFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) { [void]$Names.Add($line) }
    }
}
$Names = $Names | Select-Object -Unique

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Run PowerShell as Administrator (or use setup-windows-from-wsl.sh)."
    exit 1
}

function Test-HostsAddr([string[]]$lines, [string]$addr, [string]$name) {
    $re = '^\s*' + [regex]::Escape($addr) + '\s+' + [regex]::Escape($name) + '(\s|$)'
    return [bool]($lines | Where-Object { $_ -match $re })
}

$existing = @(Get-Content $HostsFile -ErrorAction SilentlyContinue)
$block = New-Object System.Collections.Generic.List[string]
foreach ($name in $Names) {
    if (Test-HostsAddr $existing "127.0.0.1" $name) {
        Write-Host "hosts ok  127.0.0.1  $name"
    } else {
        [void]$block.Add("127.0.0.1  $name")
        Write-Host "hosts add  127.0.0.1  $name"
    }
}
if ($block.Count -gt 0) {
    Add-Content -Path $HostsFile -Value ($block -join "`r`n")
}

$ca = $CaPath
if (-not $ca -or -not (Test-Path $ca)) {
    $candidates = @(
        (Join-Path $PSScriptRoot "..\deploy\certs\ca\ca.crt")
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path $p)) { $ca = $p; break }
    }
}
if (-not $ca -or -not (Test-Path $ca)) {
    Write-Error "Hull CA not found. In WSL: ./scripts/generate-certs.sh"
    exit 1
}

certutil -addstore -f ROOT $ca | Out-Host
ipconfig /flushdns | Out-Null
Write-Host "SETUP_OK  www https://${HostName}/  app https://app.${HostName}/  admin https://admin.${HostName}/  mail https://mail.${HostName}/"
