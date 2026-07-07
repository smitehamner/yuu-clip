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

$root          = Split-Path $PSScriptRoot -Parent
$lockPath      = "$root\requirements.lock"
$runtimePython = "$root\build\python-runtime\python.exe"
$wheelhouseDir = "$root\build\wheelhouse"
$marker        = "$wheelhouseDir\.lock-hash"

# Prebuilt llama-cpp-python CPU wheel (Tier A default LLM engine). llama-cpp-python
# is NOT a binary on PyPI (sdist only), so the `pip download --only-binary` pass
# below can never fetch it. Pull it straight from abetlen's GitHub release into the
# same wheelhouse so first-run installs the LLM engine OFFLINE from a wheel instead
# of triggering a from-source compile (which needs MSVC/CMake and fails for end
# users). GPU (CUDA) wheels stay Tier C: selected and force-reinstalled online at
# wizard time (electron/llamacpp-cuda.js). Keep $llamaCpuVersion in sync with
# LLAMA_CPP_CUDA_VERSION there, and inside the pyproject `llama-cpp-python>=0.3,<1.0` bound.
$llamaCpuVersion = '0.3.32'
$llamaCpuWheel   = "llama_cpp_python-$llamaCpuVersion-py3-none-win_amd64.whl"
$llamaCpuUrl     = "https://github.com/abetlen/llama-cpp-python/releases/download/v$llamaCpuVersion/$llamaCpuWheel"

if (-not (Test-Path $lockPath)) {
    Write-Error "requirements.lock missing - run scripts\lock-deps.ps1 first."
    exit 1
}
if (-not (Test-Path $runtimePython)) {
    Write-Error "Bundled Python runtime not found at $runtimePython - run scripts\fetch-python-runtime.ps1 first."
    exit 1
}

$lockHash = (Get-FileHash -Path $lockPath -Algorithm SHA256).Hash.ToLower()
# Key the cache marker on the lock hash AND the pinned llama CPU wheel version: that
# wheel lives in the wheelhouse but is intentionally NOT in requirements.lock, so a
# $llamaCpuVersion bump alone must still invalidate the cache and re-fetch it.
$markerValue = "$lockHash|$llamaCpuVersion"
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

Write-Host "Adding prebuilt llama-cpp-python CPU wheel ($llamaCpuVersion) to the wheelhouse..."
$llamaDest = Join-Path $wheelhouseDir $llamaCpuWheel
try {
    Invoke-WebRequest -Uri $llamaCpuUrl -OutFile $llamaDest -UseBasicParsing
} catch {
    Remove-Item $wheelhouseDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Error "Failed to download llama-cpp-python CPU wheel from $llamaCpuUrl : $($_.Exception.Message)"
    exit 1
}
if (-not (Test-Path $llamaDest) -or (Get-Item $llamaDest).Length -eq 0) {
    Remove-Item $wheelhouseDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Error "llama-cpp-python CPU wheel download produced an empty file at $llamaDest."
    exit 1
}

$wheelCount = (Get-ChildItem "$wheelhouseDir\*.whl" | Measure-Object).Count
Set-Content -Path $marker -Value $markerValue -NoNewline
Write-Host "Wheelhouse ready: $wheelCount wheels in $wheelhouseDir"
