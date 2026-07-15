# fetch-ffmpeg-runtime.ps1 - download the pinned GPL Windows FFmpeg build bundled
# into the Electron installer, plus the exact matching source archives shipped
# alongside every release for GPLv3 compliance (see
# docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md).
#
# Source: GyanD/codexffmpeg (github.com/GyanD/codexffmpeg), a numbered-tag GitHub
# Releases mirror of the gyan.dev Windows builds - same durable hosting model as
# python-build-standalone, unlike BtbN's FFmpeg-Builds "latest" tag (mutable/pruned).
#
# CRITICAL: only ever pin an "essentials_build" or "full_build" asset (GPL v3,
# --enable-gpl --enable-version3, includes libx264). NEVER swap in a build whose
# README reports --enable-nonfree (e.g. one bundling libfdk_aac or Blackmagic
# DeckLink) - that changes the distribution terms and is exactly what
# tests/test_ffmpeg_licensing.py's nonfree-component guard exists to catch.
#
# Bump FFMPEG_VERSION/ASSET_NAME/SHA256 together when re-pinning the binary; also
# re-derive X264_* below (run the new ffmpeg.exe on a trivial libx264 encode -
# the "264 - core NNN rNNNN <hash>" line in stderr gives the exact x264 commit)
# and re-fetch both source archives. Re-pinning is a three-file change - see the
# "Bundled FFmpeg" section of docs/dev/HOW-TO-RELEASE.md.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$FFMPEG_VERSION = '8.1.2'
$ASSET_NAME     = "ffmpeg-$FFMPEG_VERSION-essentials_build.zip"
$SHA256         = 'db580001caa24ac104c8cb856cd113a87b0a443f7bdf47d8c12b1d740584a2ec'
$DOWNLOAD_URL   = "https://github.com/GyanD/codexffmpeg/releases/download/$FFMPEG_VERSION/$ASSET_NAME"

# Matching FFmpeg source - official release tarball (ffmpeg.org publishes no
# checksum file for it; SHA256 below was computed from the download itself, same
# as the binary asset above).
$FFMPEG_SRC_NAME = "ffmpeg-$FFMPEG_VERSION.tar.xz"
$FFMPEG_SRC_SHA256 = '464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c'
$FFMPEG_SRC_URL  = "https://ffmpeg.org/releases/$FFMPEG_SRC_NAME"

# Matching libx264 source - the exact commit statically linked into the pinned
# build above (read from the "264 - core 165 r3223 0480cb0 -..." line that
# libx264 prints to stderr when ffmpeg.exe runs an actual libx264 encode; not
# shown by `ffmpeg -version`, which only lists linked library *names*).
#
# Vendored in-repo (docs/dev/third-party-source/) rather than fetched here:
# code.videolan.org is the only distribution point for x264 source (it has no
# numbered releases, only git commits) and sits behind an Anubis anti-bot
# challenge that blocks non-browser HTTP clients - Invoke-WebRequest gets an
# HTML challenge page back instead of the archive. A build script can't solve
# a JS proof-of-work challenge, so re-fetching it automatically isn't reliable.
$X264_COMMIT      = '0480cb0'
$X264_SRC_NAME    = "x264-$X264_COMMIT.tar.gz"
$X264_SRC_SHA256  = '8f3073feb4b98eba64f0439621cde77192d44799fd04018edb1cce80d7322bb9'

$root       = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent  # repo root (script lives in scripts/windows-release/)
$cacheDir   = "$root\build\ffmpeg-runtime-cache"
$runtimeDir = "$root\build\ffmpeg-runtime"
$versionMarker = "$runtimeDir\.version"
$sourceDir  = "$root\build\ffmpeg-source"
$X264_SRC_VENDORED = "$root\docs\dev\third-party-source\$X264_SRC_NAME"

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

$pinLabel = "$FFMPEG_VERSION+x264-$X264_COMMIT"
if ((Test-Path $versionMarker) -and (Get-Content $versionMarker -Raw).Trim() -eq $pinLabel) {
    Write-Host "FFmpeg runtime $pinLabel already extracted at $runtimeDir"
    exit 0
}

New-Item -ItemType Directory -Force -Path $cacheDir  | Out-Null
New-Item -ItemType Directory -Force -Path $sourceDir | Out-Null

# ── Binary (bundled into the installer) ──────────────────────────────────────
$archive = "$cacheDir\$ASSET_NAME"
Get-VerifiedDownload $DOWNLOAD_URL $SHA256 $archive

if (Test-Path $runtimeDir) { Remove-Item $runtimeDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

$extractDir = "$cacheDir\extracted"
if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
Write-Host "Extracting $ASSET_NAME..."
Expand-Archive -Path $archive -DestinationPath $extractDir -Force

$binDir = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'bin' }
if (-not $binDir -or -not (Test-Path "$binDir\ffmpeg.exe") -or -not (Test-Path "$binDir\ffprobe.exe")) {
    Write-Error "Expected bin\ffmpeg.exe and bin\ffprobe.exe after extracting $ASSET_NAME but they were not found"
    exit 1
}
# Only ship ffmpeg.exe/ffprobe.exe - ffplay.exe, doc/, presets/ aren't used by
# yuu_clip and would bloat the installer. The GPL license text is committed
# separately at electron/resources/LICENSE-FFMPEG-GPL.txt (extraResources'd
# alongside, not sourced from this archive) so it ships even though we don't
# copy this archive's own LICENSE/README here.
Copy-Item "$binDir\ffmpeg.exe"  "$runtimeDir\ffmpeg.exe"
Copy-Item "$binDir\ffprobe.exe" "$runtimeDir\ffprobe.exe"
Remove-Item $extractDir -Recurse -Force

Set-Content -Path $versionMarker -Value $pinLabel -NoNewline
Write-Host "FFmpeg runtime ready: $runtimeDir\ffmpeg.exe"

# ── Matching source archives (shipped alongside the installer, not bundled
#    inside it - see build-release.ps1 step that copies build/ffmpeg-source/*
#    into build/installer/) ───────────────────────────────────────────────────
Get-VerifiedDownload $FFMPEG_SRC_URL $FFMPEG_SRC_SHA256 "$sourceDir\$FFMPEG_SRC_NAME"

if (-not (Test-Path $X264_SRC_VENDORED)) {
    Write-Error "Vendored x264 source not found at $X264_SRC_VENDORED (see comment above - it isn't fetched automatically)"
    exit 1
}
$x264Hash = (Get-FileHash -Path $X264_SRC_VENDORED -Algorithm SHA256).Hash.ToLower()
if ($x264Hash -ne $X264_SRC_SHA256) {
    Write-Error "Vendored x264 source hash mismatch (expected $X264_SRC_SHA256, got $x264Hash) - re-pin didn't update the vendored file"
    exit 1
}
Copy-Item $X264_SRC_VENDORED "$sourceDir\$X264_SRC_NAME" -Force
Write-Host "FFmpeg + x264 source archives ready in $sourceDir"
