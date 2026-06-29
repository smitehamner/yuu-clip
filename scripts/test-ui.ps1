$ErrorActionPreference = "Stop"
& "$env:USERPROFILE\.claude\sound-cancel.ps1"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$LogFile  = Join-Path $RepoRoot "test-ui-last.log"

Write-Host "UI tests require a live server at http://127.0.0.1:8080 (run scripts\serve.ps1 first)" -ForegroundColor Yellow
Write-Host "Log: $LogFile" -ForegroundColor DarkGray

Push-Location $RepoRoot
$testExitCode = 0
try {
    $env:PYTHONUNBUFFERED = "1"
    & $Python -u -m pytest tests/test_ui.py -v --tb=short --no-header -p no:warnings --timeout=60 -r fE @args 2>&1 |
        Tee-Object -FilePath $LogFile
    $testExitCode = $LASTEXITCODE
} finally {
    Pop-Location

    $lines = Get-Content $LogFile -ErrorAction SilentlyContinue
    if ($lines) {
        $summaryStart = $null
        for ($i = $lines.Length - 1; $i -ge 0; $i--) {
            if ($lines[$i] -match 'short test summary info') { $summaryStart = $i; break }
        }
        if ($null -eq $summaryStart) { $summaryStart = [Math]::Max(0, $lines.Length - 5) }

        Write-Host ""
        Write-Host "--- Summary ---" -ForegroundColor Cyan
        $lines[$summaryStart..($lines.Length - 1)] | ForEach-Object { Write-Host $_ }
        Write-Host ""
        Write-Host "Full log: $LogFile" -ForegroundColor DarkGray
    }

    $player = New-Object Media.SoundPlayer 'C:\Windows\Media\tada.wav'
    $player.Play()
    Start-Sleep -Milliseconds 2000
}
exit $testExitCode
