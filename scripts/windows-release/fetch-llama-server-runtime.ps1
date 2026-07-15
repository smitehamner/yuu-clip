# fetch-llama-server-runtime.ps1 - download the pinned upstream llama.cpp
# `llama-server` Windows binaries (Vulkan + CPU) bundled into the Electron
# installer, so end users get GPU-accelerated local LLM/vision inference without
# installing anything themselves. llama.cpp is MIT (electron/resources/
# LICENSE-LLAMA-CPP-MIT.txt ships alongside).
#
# Two builds are bundled (see the bundled-vulkan-llamacpp plan, decision 4):
#   vulkan\ - offloads to NVIDIA / AMD / Intel GPUs via the ggml Vulkan backend.
#   cpu\    - driverless fallback for a machine with no Vulkan runtime at all.
# The app prefers vulkan\ and falls back to cpu\ (see
# yuu_clip/scoring/llamacpp_server.py resolve_server_binary / the pool's spawn
# retry). Both are ISA-safe (runtime CPU-feature dispatch), so unlike the old
# llama-cpp-python wheels they do NOT reintroduce the AVX-512 crash.
#
# Bump LLAMA_BUILD + both SHA256s together when re-pinning. Verify the new build
# still spawns and passes a text + image smoke test on a real GPU before shipping
# (there is no CI inference test - see the plan's "release-time smoke check").

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$LLAMA_BUILD    = 'b9934'
$VULKAN_ASSET   = "llama-$LLAMA_BUILD-bin-win-vulkan-x64.zip"
$VULKAN_SHA256  = '20ea5f484c0ae373affd5c5032b718bf3b9e15a31db5c93bfbbb6d9323824a23'
$CPU_ASSET      = "llama-$LLAMA_BUILD-bin-win-cpu-x64.zip"
$CPU_SHA256     = 'dba3a85a954c14ea69f03d0f7c5c805b4b3e5387940e5543dbdaf55a12a4c385'
$RELEASE_BASE   = "https://github.com/ggml-org/llama.cpp/releases/download/$LLAMA_BUILD"

$root       = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent  # repo root (script lives in scripts/windows-release/)
$cacheDir   = "$root\build\llama-server-runtime-cache"
$runtimeDir = "$root\build\llama-server-runtime"
$versionMarker = "$runtimeDir\.version"

function Get-VerifiedDownload($url, $sha256, $outFile) {
    if (Test-Path $outFile) {
        $existingHash = (Get-FileHash -Path $outFile -Algorithm SHA256).Hash.ToLower()
        if ($existingHash -eq $sha256) {
            Write-Host "Using cached, verified file: $outFile"
            return
        }
        Write-Host "Cached file hash mismatch, re-downloading: $outFile"
        Remove-Item $outFile -Force
    }
    Write-Host "Downloading $url..."
    Invoke-WebRequest -Uri $url -OutFile $outFile
    $actualHash = (Get-FileHash -Path $outFile -Algorithm SHA256).Hash.ToLower()
    if ($actualHash -ne $sha256) {
        Remove-Item $outFile -Force
        Write-Error "SHA256 mismatch for $outFile (expected $sha256, got $actualHash). Deleted corrupt download; re-run to retry."
        exit 1
    }
    Write-Host "SHA256 verified: $actualHash"
}

function Expand-LlamaBuild($archive, $destSubdir) {
    $extractDir = "$cacheDir\extract-$destSubdir"
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
    Write-Host "Extracting $archive -> $destSubdir\..."
    Expand-Archive -Path $archive -DestinationPath $extractDir -Force
    # Upstream zips extract the exe + DLLs flat (no top-level folder). Guard it.
    if (-not (Test-Path "$extractDir\llama-server.exe")) {
        Write-Error "Expected llama-server.exe at the root of $archive but it was not found"
        exit 1
    }
    $target = "$runtimeDir\$destSubdir"
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    # Ship only what llama-server needs at runtime: the server exe and every DLL
    # (ggml backends + Vulkan/runtime libs). The other CLI exes and tools bloat
    # the installer and are never spawned by yuu-clip.
    Copy-Item "$extractDir\llama-server.exe" $target -Force
    Copy-Item "$extractDir\*.dll" $target -Force
    Remove-Item $extractDir -Recurse -Force
}

if ((Test-Path $versionMarker) -and (Get-Content $versionMarker -Raw).Trim() -eq $LLAMA_BUILD) {
    Write-Host "llama-server runtime $LLAMA_BUILD already extracted at $runtimeDir"
    exit 0
}

New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
if (Test-Path $runtimeDir) { Remove-Item $runtimeDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

Get-VerifiedDownload "$RELEASE_BASE/$VULKAN_ASSET" $VULKAN_SHA256 "$cacheDir\$VULKAN_ASSET"
Get-VerifiedDownload "$RELEASE_BASE/$CPU_ASSET"    $CPU_SHA256    "$cacheDir\$CPU_ASSET"

Expand-LlamaBuild "$cacheDir\$VULKAN_ASSET" 'vulkan'
Expand-LlamaBuild "$cacheDir\$CPU_ASSET"    'cpu'

Set-Content -Path $versionMarker -Value $LLAMA_BUILD -NoNewline
Write-Host "llama-server runtime ready: $runtimeDir (vulkan\ + cpu\)"
