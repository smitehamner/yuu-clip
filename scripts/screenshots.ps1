param(
    [switch]$List,
    [string]$Only
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$Script   = Join-Path $RepoRoot "scripts\screenshots.py"

$scriptArgs = @()
if ($List)         { $scriptArgs += "--list" }
if ($Only)         { $scriptArgs += @("--only", $Only) }

Push-Location $RepoRoot
try {
    & $Python $Script @scriptArgs
} finally {
    Pop-Location
}
