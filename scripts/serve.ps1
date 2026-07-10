# Thin shim: the dev-loop logic now lives in the yuu_clip.dev Python CLI
# (yuu-dev serve). Kept so `.\scripts\serve.ps1` still works. Maps the old
# -Stop switch to the new --stop flag; all other args pass through.
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$map = @{ '-stop' = '--stop'; '-yes' = '--yes' }
# @(...) forces an array: a single forwarded flag would otherwise be a scalar
# string, and PowerShell's @splat iterates a string char-by-char (--stop -> - - s t o p).
$fwd = @(foreach ($a in $args) { if ($map.ContainsKey("$a".ToLower())) { $map["$a".ToLower()] } else { $a } })
& $Python -m yuu_clip.dev serve @fwd
exit $LASTEXITCODE
