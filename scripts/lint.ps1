# Thin shim: logic now lives in the yuu_clip.dev Python CLI (yuu-dev lint).
# Args (e.g. --fix) pass straight through to ruff.
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"
& $Python -m yuu_clip.dev lint @args
exit $LASTEXITCODE
