# Thin shim: logic now lives in the yuu_clip.dev Python CLI (yuu-dev status).
# Exits 0 if nothing is processing (safe to restart), 1 if a job is active.
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"
& $Python -m yuu_clip.dev status @args
exit $LASTEXITCODE
