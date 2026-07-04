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

# The UI suite runs against the single shared dev server on :8080, so two runs
# at once (e.g. two Claude sessions) corrupt each other's DB state and produce
# spurious failures. Guard with an atomic lock file. CreateNew is atomic, so
# only one caller wins even if both start simultaneously; a lock older than
# $LockMaxAgeMin is treated as stale (a crashed run) and reclaimed.
$LockFile      = Join-Path $RepoRoot "test-ui.lock"
$LockMaxAgeMin = 15
$LockAcquired  = $false
for ($attempt = 0; $attempt -lt 2 -and -not $LockAcquired; $attempt++) {
    try {
        $fs = [System.IO.File]::Open($LockFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("PID $PID started $(Get-Date -Format o)")
        $fs.Write($bytes, 0, $bytes.Length)
        $fs.Close()
        $LockAcquired = $true
    } catch [System.IO.IOException] {
        $age = (Get-Date) - (Get-Item $LockFile -ErrorAction SilentlyContinue).LastWriteTime
        if ($age.TotalMinutes -ge $LockMaxAgeMin) {
            Write-Host "Removing stale UI test lock ($([int]$age.TotalMinutes) min old)." -ForegroundColor Yellow
            Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
        } else {
            $holder = (Get-Content $LockFile -Raw -ErrorAction SilentlyContinue).Trim()
            Write-Host "Another UI test run is already in progress ($holder)." -ForegroundColor Red
            Write-Host "UI tests share the live server on :8080 - running two at once corrupts state." -ForegroundColor Red
            Write-Host "Wait for it to finish, or delete $LockFile if you are sure it is stale." -ForegroundColor Red
            exit 2
        }
    }
}

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
    if ($LockAcquired) { Remove-Item $LockFile -Force -ErrorAction SilentlyContinue }

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
