$RepoRoot = Split-Path -Parent $PSScriptRoot
$Log      = Join-Path $RepoRoot ".yuu-clip\yuu-clip.log"

Write-Host "Tailing $Log  (Ctrl+C to stop)" -ForegroundColor Cyan
Get-Content $Log -Wait -Tail 20
