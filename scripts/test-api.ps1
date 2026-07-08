param(
    [switch]$Detailed,
    [Parameter(ValueFromRemainingArguments = $true)]$PytestArgs
)
$ErrorActionPreference = "Stop"
& "$env:USERPROFILE\.claude\scripts\sound-cancel.ps1"
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
    # Exclude the Playwright UI suite (test_ui_*.py) - those need a live server
    # and belong to test-ui.ps1. This keeps test-api.ps1 fast and server-free.
    # pytest-xdist writes "bringing up nodes..." to stderr; 2>&1 merges it, and
    # under $ErrorActionPreference='Stop' PS 5.1 promotes that merged stderr to a
    # terminating NativeCommandError that skips the `exit $testExitCode` below --
    # so the script would report exit 1 even on a fully green run, decoupling its
    # exit code from the real pytest result. Drop to Continue around just the
    # native call so pytest's actual exit code propagates.
    $ErrorActionPreference = "Continue"
    & $Python -u -m pytest tests/ --ignore-glob="tests/test_ui_*.py" -n auto $Verbosity --tb=short -p no:warnings -r fE @PytestArgs 2>&1 |
        Tee-Object -FilePath $LogFile
    $testExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
} finally {
    Pop-Location

    $lines = Get-Content $LogFile -ErrorAction SilentlyContinue
    if ($lines) {
        # Summary file = everything from the first failure section onward
        # (FAILURES + short test summary + result line). Falls back to the lines
        # ending at pytest's result line on an all-green run.
        $summaryStart = $null
        for ($i = 0; $i -lt $lines.Length; $i++) {
            if ($lines[$i] -match '^=+ (FAILURES|ERRORS) =+$') { $summaryStart = $i; break }
        }
        if ($null -eq $summaryStart) {
            for ($i = $lines.Length - 1; $i -ge 0; $i--) {
                if ($lines[$i] -match 'short test summary info') { $summaryStart = $i; break }
            }
        }
        # pytest's result line ("N passed in Xs") is the authoritative end of real
        # output; the 2>&1 stderr merge can append PowerShell NativeCommandError
        # noise after it, so end the summary there instead of at the raw last line.
        $summaryEnd = $lines.Length - 1
        for ($i = $lines.Length - 1; $i -ge 0; $i--) {
            if ($lines[$i] -match '\d+ (passed|failed|error|skipped).* in ') { $summaryEnd = $i; break }
        }
        if ($null -eq $summaryStart) { $summaryStart = [Math]::Max(0, $summaryEnd - 4) }
        $summaryLines = $lines[$summaryStart..$summaryEnd]
        $summaryLines | Out-File -FilePath $SummaryFile -Encoding utf8

        Write-Host ""
        Write-Host "--- Summary ---" -ForegroundColor Cyan
        $summaryLines | Select-Object -Last 40 | ForEach-Object { Write-Host $_ }
        Write-Host ""
        Write-Host "Full log: $LogFile  |  Summary: $SummaryFile" -ForegroundColor DarkGray
    }
}
exit $testExitCode
