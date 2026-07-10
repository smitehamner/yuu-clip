# Thin shim: folded into the yuu_clip.dev Python CLI (yuu-dev status --wait).
# Polls until the server answers, then exits 0; exits 1 on timeout.
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"
& $Python -m yuu_clip.dev status --wait @args
exit $LASTEXITCODE
