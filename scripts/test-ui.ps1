$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"

Write-Host "UI tests require a live server at http://127.0.0.1:8080 (run scripts\serve.ps1 first)" -ForegroundColor Yellow

Push-Location $RepoRoot
try {
    $env:PYTHONUNBUFFERED = "1"
    & $Python -u -m pytest tests/test_ui.py -v --tb=short --no-header -p no:warnings --timeout=60 @args
} finally {
    Pop-Location
    $player = New-Object Media.SoundPlayer 'C:\Windows\Media\tada.wav'
    $player.Play()
    Start-Sleep -Milliseconds 2000
}
