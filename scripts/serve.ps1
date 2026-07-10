# Thin shim: the dev-loop logic now lives in the yuu_clip.dev Python CLI
# (yuu-dev serve). Kept so `.\scripts\serve.ps1` still works. Maps the old
# -Stop switch to the new --stop flag; all other args pass through.
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$map = @{ '-stop' = '--stop'; '-yes' = '--yes' }
$fwd = foreach ($a in $args) { if ($map.ContainsKey("$a".ToLower())) { $map["$a".ToLower()] } else { $a } }
& $Python -m yuu_clip.dev serve @fwd
exit $LASTEXITCODE
