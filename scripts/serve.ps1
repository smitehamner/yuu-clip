param([switch]$Stop)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$Log      = Join-Path $RepoRoot ".yuu-clip\yuu-clip.log"

$old = netstat -ano | findstr ":8080" | Select-String "LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] }
if ($old) {
    Write-Host "Killing PID $old on :8080..." -ForegroundColor Yellow
    Stop-Process -Id $old -Force
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
