# fetch-wheelhouse.ps1 - pre-download the base runtime dependencies as wheels so
# the packaged first-run installer can install them OFFLINE (--no-index), instead
# of resolving faster-whisper / CTranslate2 / av / scipy from PyPI at first launch
# (which fails for non-developer users on slow, firewalled, or proxied networks).
#
# Uses the BUNDLED runtime's python so the downloaded wheels match the exact
# interpreter / platform / abi that ships in the installer. Run
# fetch-python-runtime.ps1 first. --only-binary=:all: guarantees the wheelhouse
# holds only wheels (never an sdist that would try to compile on the user's
# machine); if a dependency has no wheel for the target it FAILS HERE - the
# correct place to discover it, not on a friend's PC.
#
# Cached like the python/ffmpeg runtimes: keyed on the requirements.lock hash, so
# it re-downloads only when the lock changes.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root          = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent  # repo root (script lives in scripts/windows-release/)
$lockPath      = "$root\requirements.lock"
$runtimePython = "$root\build\python-runtime\python.exe"
$wheelhouseDir = "$root\build\wheelhouse"
$marker        = "$wheelhouseDir\.lock-hash"

# The local LLM/vision backend no longer bundles a llama-cpp-python wheel: it now
# drives upstream's Vulkan llama-server binary over HTTP (fetched separately by
# scripts\windows-release\fetch-llama-server-runtime.ps1). So this wheelhouse holds only the base
# runtime dependencies from requirements.lock below.

if (-not (Test-Path $lockPath)) {
    Write-Error "requirements.lock missing - run scripts\lock-deps.ps1 first."
    exit 1
}
if (-not (Test-Path $runtimePython)) {
    Write-Error "Bundled Python runtime not found at $runtimePython - run scripts\windows-release\fetch-python-runtime.ps1 first."
    exit 1
}

$lockHash = (Get-FileHash -Path $lockPath -Algorithm SHA256).Hash.ToLower()
$markerValue = $lockHash
if ((Test-Path $marker) -and (Get-Content $marker -Raw).Trim() -eq $markerValue) {
    Write-Host "Wheelhouse already built for this requirements.lock at $wheelhouseDir"
    exit 0
}

if (Test-Path $wheelhouseDir) { Remove-Item $wheelhouseDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $wheelhouseDir | Out-Null

Write-Host "Downloading base dependency wheels into $wheelhouseDir (bundled runtime)..."
& $runtimePython -m pip download --only-binary=:all: --dest $wheelhouseDir -r $lockPath
if ($LASTEXITCODE -ne 0) {
    Remove-Item $wheelhouseDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Error "pip download failed (exit $LASTEXITCODE). If a dependency has no binary wheel for the bundled runtime, that must be resolved before shipping - an sdist would try to compile on the user's machine."
    exit 1
}

$wheelCount = (Get-ChildItem "$wheelhouseDir\*.whl" | Measure-Object).Count
if ($wheelCount -eq 0) {
    Write-Error "Wheelhouse is empty after pip download."
    exit 1
}

Set-Content -Path $marker -Value $markerValue -NoNewline
Write-Host "Wheelhouse ready: $wheelCount wheels in $wheelhouseDir"
