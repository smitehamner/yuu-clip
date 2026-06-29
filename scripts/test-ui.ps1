$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"

Write-Host "UI tests require a live server at http://127.0.0.1:8080 (run scripts\serve.ps1 first)" -ForegroundColor Yellow

Push-Location $RepoRoot
try {
    & $Python -m pytest tests/test_ui.py -v --tb=short --no-header -p no:warnings --screenshot=only-on-failure @args
} finally {
    Pop-Location
    (New-Object Media.SoundPlayer 'C:\Windows\Media\tada.wav').PlaySync()
}
