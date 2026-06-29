$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"

Push-Location $RepoRoot
try {
    $env:PYTHONUNBUFFERED = "1"
    & $Python -u -m pytest tests/ --ignore=tests/test_ui.py -v @args
} finally {
    Pop-Location
}
