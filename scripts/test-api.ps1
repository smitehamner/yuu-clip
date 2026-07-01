$ErrorActionPreference = "Stop"
& "$env:USERPROFILE\.claude\sound-cancel.ps1"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$LogFile  = Join-Path $RepoRoot "test-api-last.log"

Write-Host "Log: $LogFile" -ForegroundColor DarkGray

Push-Location $RepoRoot
$testExitCode = 0
try {
    $env:PYTHONUNBUFFERED = "1"
    # Exclude the Playwright UI suite (test_ui_*.py) — those need a live server
    # and belong to test-ui.ps1. This keeps test-api.ps1 fast and server-free.
    & $Python -u -m pytest tests/ --ignore-glob="tests/test_ui_*.py" -n auto -v --tb=short -p no:warnings -r fE @args 2>&1 |
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
}
exit $testExitCode
