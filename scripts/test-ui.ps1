param(
    [switch]$Detailed,
    [switch]$Sequential,
    [Parameter(ValueFromRemainingArguments = $true)]$PytestArgs
)
$ErrorActionPreference = "Stop"
& "$env:USERPROFILE\.claude\scripts\sound-cancel.ps1"
$RepoRoot    = Split-Path -Parent $PSScriptRoot
$Python      = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$LogFile     = Join-Path $RepoRoot "test-ui-last.log"
$SummaryFile = Join-Path $RepoRoot "test-ui-last-summary.log"

Write-Host "UI tests require a live server at http://127.0.0.1:8080 (run scripts\serve.ps1 first)" -ForegroundColor Yellow
Write-Host "Log: $LogFile" -ForegroundColor DarkGray

# Default is quiet (dots + failures only) to keep the log small for automated
# reads; pass -Detailed for the old per-test -v output.
$Verbosity = if ($Detailed) { "-v" } else { "-q" }

Push-Location $RepoRoot
$testExitCode = 0
try {
    $env:PYTHONUNBUFFERED = "1"
    # PowerShell does not glob-expand args to native commands, so resolve the
    # test files here and pass explicit paths to pytest.
    $UiTests = Get-ChildItem -Path (Join-Path $RepoRoot "tests") -Filter "test_ui_*.py" | ForEach-Object { $_.FullName }
    # 4 xdist workers (one Chromium each), whole files per worker: tests within a
    # file share live-server state assumptions. Worker restarts are disabled so a
    # genuine worker death fails fast instead of cascading into a scheduler crash.
    $ParallelArgs = @()
    if (-not $Sequential) { $ParallelArgs = @("-n", "4", "--dist", "loadfile", "--max-worker-restart", "0") }
    & $Python -u -m pytest $UiTests $Verbosity --tb=short --no-header -p no:warnings --timeout=60 -r fE @ParallelArgs @PytestArgs 2>&1 |
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

    # Tada chime disabled now that the teardown hang is fixed. Kept here so we
    # can re-enable it if the ProactorEventLoop teardown hang resurfaces.
    # $player = New-Object Media.SoundPlayer 'C:\Windows\Media\tada.wav'
    # $player.Play()
    # Start-Sleep -Milliseconds 2000
}
exit $testExitCode
