param(
    [switch]$Detailed,
    [switch]$Sequential,
    [switch]$Changed,
    [switch]$Smoke,
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
    # test files here and pass explicit paths to pytest. Three selection modes:
    #   -Smoke    the small backstop file only (fastest sanity check)
    #   -Changed  tests mapped from the working-tree diff + smoke (dev default)
    #   (neither) the whole test_ui_*.py suite (pre-review / cross-cutting change)
    $SmokeFile = Join-Path $RepoRoot "tests\test_ui_smoke.py"
    if ($Smoke) {
        $UiTests = @($SmokeFile)
    } elseif ($Changed) {
        # The mapper writes selected paths to stdout and advisories to stderr.
        # Capture stderr to a temp file so PS 5.1 does not promote it to a
        # terminating error, then echo the advisories for the developer.
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $noteFile = [System.IO.Path]::GetTempFileName()
        $selected = & $Python (Join-Path $RepoRoot "scripts\select_ui_tests.py") 2>$noteFile
        $ErrorActionPreference = $prevEAP
        Get-Content $noteFile -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ -ForegroundColor DarkYellow }
        Remove-Item $noteFile -Force -ErrorAction SilentlyContinue
        $UiTests = @($selected | Where-Object { $_ } | ForEach-Object { Join-Path $RepoRoot $_ })
        if (-not $UiTests) { $UiTests = @($SmokeFile) }
    } else {
        $UiTests = Get-ChildItem -Path (Join-Path $RepoRoot "tests") -Filter "test_ui_*.py" | ForEach-Object { $_.FullName }
    }
    Write-Host ("Running {0} UI test file(s):" -f @($UiTests).Count) -ForegroundColor Cyan
    @($UiTests) | ForEach-Object { Write-Host "  $(Split-Path $_ -Leaf)" -ForegroundColor DarkGray }

    # xdist workers (one Chromium each), whole files per worker: tests within a
    # file share live-server state assumptions. Worker restarts are disabled so a
    # genuine worker death fails fast instead of cascading into a scheduler crash.
    # Cap workers at the selected file count so a small targeted run does not
    # spin up 4 browsers for 2 files; a single file runs in-process (no xdist).
    $ParallelArgs = @()
    if (-not $Sequential) {
        $workerCount = [Math]::Min(4, [Math]::Max(1, @($UiTests).Count))
        if ($workerCount -ge 2) {
            $ParallelArgs = @("-n", "$workerCount", "--dist", "loadfile", "--max-worker-restart", "0")
        }
    }
    # pytest-xdist writes "bringing up nodes..." to stderr; 2>&1 merges it, and
    # under $ErrorActionPreference='Stop' PS 5.1 promotes that merged stderr to a
    # terminating NativeCommandError that skips the `exit $testExitCode` below --
    # so the script would report exit 1 even on a fully green run, decoupling its
    # exit code from the real pytest result. Drop to Continue around just the
    # native call so pytest's actual exit code propagates.
    $ErrorActionPreference = "Continue"
    & $Python -u -m pytest $UiTests $Verbosity --tb=short --no-header -p no:warnings --timeout=60 -r fE @ParallelArgs @PytestArgs 2>&1 |
        Tee-Object -FilePath $LogFile
    $testExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
} finally {
    Pop-Location
    if ($LockAcquired) { Remove-Item $LockFile -Force -ErrorAction SilentlyContinue }

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

    # Tada chime disabled now that the teardown hang is fixed. Kept here so we
    # can re-enable it if the ProactorEventLoop teardown hang resurfaces.
    # $player = New-Object Media.SoundPlayer 'C:\Windows\Media\tada.wav'
    # $player.Play()
    # Start-Sleep -Milliseconds 2000
}
exit $testExitCode
