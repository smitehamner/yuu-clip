param([switch]$Stop)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$Log      = Join-Path $RepoRoot ".yuu-clip\yuu-clip.log"

# Kill every serve process for this project, not just the one bound to :8080.
# The venv python.exe is a launcher stub that spawns a worker child (both carry
# the same command line), and a worker that loses the port race can orphan and
# keep an export file open — which blocks deletes. Matching on the command line
# clears parent, child, and any stray so each start is from a clean slate.
$serveProcs = Get-CimInstance Win32_Process -Filter "name='python.exe'" |
    Where-Object { $_.CommandLine -like "*yuu_clip.cli serve*" -and $_.CommandLine -like "*$RepoRoot*" }
foreach ($p in $serveProcs) {
    Write-Host "Killing stale serve PID $($p.ProcessId)..." -ForegroundColor Yellow
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

# Safety net: a non-python process holding :8080 still blocks the bind.
$old = netstat -ano | findstr ":8080" | Select-String "LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] }
if ($old) {
    Write-Host "Killing PID $old on :8080..." -ForegroundColor Yellow
    Stop-Process -Id $old -Force -ErrorAction SilentlyContinue
}
if ($serveProcs -or $old) {
    Start-Sleep -Milliseconds 500
}

if ($Stop) {
    Write-Host "Server stopped." -ForegroundColor Yellow
    exit 0
}

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName        = $Python
$psi.Arguments       = "-m yuu_clip.cli serve --project `"$RepoRoot`""
$psi.WorkingDirectory = $RepoRoot
$psi.WindowStyle     = "Hidden"
$psi.UseShellExecute = $true
[System.Diagnostics.Process]::Start($psi) | Out-Null

Write-Host "Server starting..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
Get-Content $Log -Tail 3
