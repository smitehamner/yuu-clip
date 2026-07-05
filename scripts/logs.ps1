$RepoRoot = Split-Path -Parent $PSScriptRoot
$Log      = Join-Path $RepoRoot ".yuu-clip\yuu-clip.log"

Write-Host "Tailing $Log  (Ctrl+C to stop)" -ForegroundColor Cyan
# -Encoding UTF8 so PowerShell 5.1 doesn't decode the log's em-dashes as cp1252
# (the file is BOM-less UTF-8, which PS 5.1 otherwise reads with the ANSI codepage).
Get-Content $Log -Wait -Tail 20 -Encoding UTF8
