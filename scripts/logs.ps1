$RepoRoot = Split-Path -Parent $PSScriptRoot
$Log      = Join-Path $RepoRoot ".rp-clipper\rp-clipper.log"

Write-Host "Tailing $Log  (Ctrl+C to stop)" -ForegroundColor Cyan
Get-Content $Log -Wait -Tail 20
