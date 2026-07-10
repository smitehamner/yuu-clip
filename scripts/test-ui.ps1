# Thin shim: logic now lives in the yuu_clip.dev Python CLI (yuu-dev test-ui).
# Maps the old PowerShell switches to their --flag equivalents; other args
# pass through to pytest.
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python   = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$map = @{
    '-changed'    = '--changed'
    '-smoke'      = '--smoke'
    '-sequential' = '--sequential'
    '-detailed'   = '--detailed'
}
# @(...) forces an array: a single forwarded flag would otherwise be a scalar
# string, and PowerShell's @splat iterates a string char-by-char (--smoke -> - - s m o k e).
$fwd = @(foreach ($a in $args) { if ($map.ContainsKey("$a".ToLower())) { $map["$a".ToLower()] } else { $a } })
& $Python -m yuu_clip.dev test-ui @fwd
exit $LASTEXITCODE
