# fetch-python-runtime.ps1 — download the pinned standalone CPython build used
# to bundle a Python runtime into the Electron installer, so end users don't
# need a system Python install.
#
# Source: astral-sh/python-build-standalone (relocatable "install_only" build).
# Bump PYBUILD_TAG/PYTHON_VERSION/SHA256 together when re-pinning; find the new
# values in that repo's release assets + SHA256SUMS file.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PYTHON_VERSION = '3.12.13'
$PYBUILD_TAG    = '20260623'
$ASSET_NAME     = "cpython-$PYTHON_VERSION+$PYBUILD_TAG-x86_64-pc-windows-msvc-install_only.tar.gz"
$SHA256         = 'c6af85bb83d5158c9ff71f50dfad467853d1cd236f932b144e87e26e2ea2a83e'
$DOWNLOAD_URL   = "https://github.com/astral-sh/python-build-standalone/releases/download/$PYBUILD_TAG/$ASSET_NAME"

$root       = Split-Path $PSScriptRoot -Parent
$cacheDir   = "$root\build\python-runtime-cache"
$archive    = "$cacheDir\$ASSET_NAME"
$runtimeDir = "$root\build\python-runtime"
$versionMarker = "$runtimeDir\.version"

if ((Test-Path $versionMarker) -and (Get-Content $versionMarker -Raw).Trim() -eq "$PYTHON_VERSION+$PYBUILD_TAG") {
    Write-Host "Python runtime $PYTHON_VERSION+$PYBUILD_TAG already extracted at $runtimeDir"
    exit 0
}

New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

if (-not (Test-Path $archive)) {
    Write-Host "Downloading $ASSET_NAME..."
    Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $archive
} else {
    Write-Host "Using cached archive: $archive"
}

$actualHash = (Get-FileHash -Path $archive -Algorithm SHA256).Hash.ToLower()
if ($actualHash -ne $SHA256) {
    Remove-Item $archive -Force
    Write-Error "SHA256 mismatch for $ASSET_NAME (expected $SHA256, got $actualHash). Deleted corrupt download; re-run to retry."
    exit 1
}
Write-Host "SHA256 verified: $actualHash"

if (Test-Path $runtimeDir) { Remove-Item $runtimeDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

Write-Host "Extracting to $runtimeDir..."
tar -xzf $archive -C $runtimeDir
if ($LASTEXITCODE -ne 0) {
    Write-Error "tar extraction failed with exit code $LASTEXITCODE"
    exit 1
}

# python-build-standalone's install_only archives contain a top-level "python/" dir.
$extractedRoot = "$runtimeDir\python"
if (-not (Test-Path "$extractedRoot\python.exe")) {
    Write-Error "Expected $extractedRoot\python.exe after extraction but it was not found"
    exit 1
}
Get-ChildItem $extractedRoot | Move-Item -Destination $runtimeDir -Force
Remove-Item $extractedRoot -Force -Recurse -ErrorAction SilentlyContinue

Set-Content -Path $versionMarker -Value "$PYTHON_VERSION+$PYBUILD_TAG" -NoNewline
Write-Host "Python runtime ready: $runtimeDir\python.exe"
