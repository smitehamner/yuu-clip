# lock-deps.ps1 — regenerate requirements.lock, the pinned base-runtime dependency
# set the packaged installer constrains user installs to (reproducible installs).
#
# Run this whenever the base dependencies in pyproject.toml change. It resolves the
# base deps (no dev / no optional extras) in a throwaway venv against current PyPI,
# then freezes the exact versions. Commit the updated requirements.lock.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root    = Split-Path $PSScriptRoot -Parent
$lockOut = Join-Path $root 'requirements.lock'
$tmpVenv = Join-Path $env:TEMP 'yuuclip-lockgen'

# Use the same minor Python we ship (3.12) so the resolution matches the runtime.
if (Test-Path $tmpVenv) { Remove-Item $tmpVenv -Recurse -Force }
py -3.12 -m venv $tmpVenv
$py = Join-Path $tmpVenv 'Scripts\python.exe'

Write-Host 'Installing base deps into a clean venv...'
& $py -m pip install --upgrade pip -q
& $py -m pip install "$root" -q
if ($LASTEXITCODE -ne 0) { throw "base install failed (exit $LASTEXITCODE)" }

$pins = & $py -m pip freeze |
    Where-Object { $_ -notmatch '^(yuu[-_]clip|pip|setuptools|wheel)(==| @)' } |
    Sort-Object

$header = @(
    '# requirements.lock - pinned base runtime dependencies for reproducible installs.',
    '#',
    '# Regenerate with scripts\lock-deps.ps1 whenever pyproject base deps change.',
    '# The packaged first-run installer passes this as `pip install -c requirements.lock',
    '# <wheel>` so every user gets exactly the versions we tested. Covers base deps only;',
    '# optional/dev extras (llamacpp, laugh-model, speechbrain/pyannote/mediapipe installed',
    '# on demand) are intentionally NOT pinned here.'
)
($header + '' + $pins) -join "`n" | Set-Content -Path $lockOut -Encoding utf8 -NoNewline

Remove-Item $tmpVenv -Recurse -Force
Write-Host "Wrote $lockOut ($($pins.Count) pins)"
