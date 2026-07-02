param(
    [switch]$Detailed,
    [Parameter(ValueFromRemainingArguments = $true)]$PytestArgs
)
$ErrorActionPreference = "Stop"
& "$env:USERPROFILE\.claude\sound-cancel.ps1"
$RepoRoot    = Split-Path -Parent $PSScriptRoot
$Python      = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$LogFile     = Join-Path $RepoRoot "test-api-last.log"
$SummaryFile = Join-Path $RepoRoot "test-api-last-summary.log"

Write-Host "Log: $LogFile" -ForegroundColor DarkGray

# Default is quiet (dots + failures only) to keep the log small for automated
# reads; pass -Detailed for the old per-test -v output.
$Verbosity = if ($Detailed) { "-v" } else { "-q" }

Push-Location $RepoRoot
$testExitCode = 0
try {
    $env:PYTHONUNBUFFERED = "1"
    # Exclude the Playwright UI suite (test_ui_*.py) — those need a live server
    # and belong to test-ui.ps1. This keeps test-api.ps1 fast and server-free.
    & $Python -u -m pytest tests/ --ignore-glob="tests/test_ui_*.py" -n auto $Verbosity --tb=short -p no:warnings -r fE @PytestArgs 2>&1 |
        Tee-Object -FilePath $LogFile
    $testExitCode = $LASTEXITCODE
} finally {
    Pop-Location

    $lines = Get-Content $LogFile -ErrorAction SilentlyContinue
    if ($lines) {
        # Summary file = everything from the first failure section onward
        # (FAILURES + short test summary + result line). Falls back to the
        # last 5 lines on an all-green run.
        $summaryStart = $null
        for ($i = 0; $i -lt $lines.Length; $i++) {
            if ($lines[$i] -match '^=+ (FAILURES|ERRORS) =+$') { $summaryStart = $i; break }
        }
        if ($null -eq $summaryStart) {
            for ($i = $lines.Length - 1; $i -ge 0; $i--) {
                if ($lines[$i] -match 'short test summary info') { $summaryStart = $i; break }
            }
        }
        if ($null -eq $summaryStart) { $summaryStart = [Math]::Max(0, $lines.Length - 5) }
        $summaryLines = $lines[$summaryStart..($lines.Length - 1)]
        $summaryLines | Out-File -FilePath $SummaryFile -Encoding utf8

        Write-Host ""
        Write-Host "--- Summary ---" -ForegroundColor Cyan
        $summaryLines | Select-Object -Last 40 | ForEach-Object { Write-Host $_ }
        Write-Host ""
        Write-Host "Full log: $LogFile  |  Summary: $SummaryFile" -ForegroundColor DarkGray
    }
}
exit $testExitCode
