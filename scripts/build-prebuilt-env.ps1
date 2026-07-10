# build-prebuilt-env.ps1 - assemble the analysis venv ONCE at build time and ship
# it, so first-run install unpacks an archive instead of running pip (no resolution,
# no compile, no per-machine variability). See
# plans/prebuilt-python-env/INDEX.md.
#
# The env is built from the EXACT wheels the wheelhouse bundles, using the EXACT
# bundled python-build-standalone runtime, so native-extension / ISA compatibility
# is identical to the pip path - only where and how fast the same files land changes.
#
# The relocation proof (step 4) is the acceptance gate: a venv that imports on the
# build machine but fails a native import after being moved would leave a user's app
# unable to start. We move the venv AND repoint it at a base python in a DIFFERENT
# location - the real runtime scenario (venv in LOCALAPPDATA, python in resources) -
# using the SAME rewritePyvenvCfg the runtime uses (electron/prebuilt-env.js), then
# re-import the heavy natives. A failure here fails the build.
#
# SLOW ON WINDOWS - the venv is ~31k files. The install (step 2), the relocation
# copies (step 4), and the tar archive (step 5) all touch every file, and Windows
# Defender real-time protection scans each one on open, which dominates the wall
# time (the tar step can sit for several minutes even though gzip itself is quick).
# To make rebuilds fast, exclude the build tree from Defender ONCE, in an ADMIN
# PowerShell:
#     Add-MpPreference -ExclusionPath "<repo>\build"
# This only affects the build machine; shipped installs are unaffected.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root          = Split-Path $PSScriptRoot -Parent
$bundledPython = "$root\build\python-runtime\python.exe"
$runtimeDir    = "$root\build\python-runtime"
$wheelhouseDir = "$root\build\wheelhouse"
$lockPath      = "$root\requirements.lock"
$outDir        = "$root\build\prebuilt-env"
$venvDir       = "$outDir\venv"
$archivePath   = "$outDir\env.tar.gz"
$versionMarker = "$outDir\prebuilt-env.version"

# Run the smoke check from a file, not `python -c`: Windows PowerShell 5.1 mangles
# embedded double-quotes when passing an argument to a native exe, which corrupts an
# inline -c string. A file has no quoting to mangle.
$smokeScript = @'
import torch, ctranslate2, cv2, faster_whisper, speechbrain, yuu_clip
print("imports OK")
'@

# -- Prerequisites -----------------------------------------------------------
if (-not (Test-Path $bundledPython)) {
    Write-Error "Bundled Python runtime not found at $bundledPython - run scripts\fetch-python-runtime.ps1 first."
    exit 1
}
if (-not (Test-Path $wheelhouseDir) -or -not (Get-ChildItem "$wheelhouseDir\*.whl" -ErrorAction SilentlyContinue)) {
    Write-Error "Wheelhouse not found or empty at $wheelhouseDir - run scripts\fetch-wheelhouse.ps1 first."
    exit 1
}
if (-not (Test-Path $lockPath)) {
    Write-Error "requirements.lock missing - run scripts\lock-deps.ps1 first."
    exit 1
}
$wheel = Get-ChildItem "$root\build\wheel\yuu_clip-*.whl" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $wheel) {
    Write-Error "No yuu_clip wheel found in build\wheel - build the wheel first (scripts\build-release.ps1 step 3)."
    exit 1
}
$wheelVersion = if ($wheel.Name -match 'yuu_clip-([^-]+)-') { $Matches[1] } else { $null }
if (-not $wheelVersion) { Write-Error "Could not parse version from wheel name $($wheel.Name)"; exit 1 }
Write-Host "Building prebuilt env for yuu_clip $wheelVersion"
Write-Host "  bundled python : $bundledPython"
Write-Host "  wheelhouse     : $wheelhouseDir"
Write-Host "  wheel          : $($wheel.FullName)"

# -- 1. Create the venv with the BUNDLED python (ABI must match what ships) ---
# Verified 2026-07-10 that `-m venv` works for the install_only runtime. If it ever
# stops working, STOP - do not fall back to a different python (ABI mismatch would
# ship a broken env).
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$smokeFile = "$outDir\smoke.py"
Set-Content -Path $smokeFile -Value $smokeScript -Encoding ASCII
Write-Host "`n[1/5] Creating venv with bundled python..."
& $bundledPython -m venv $venvDir
if ($LASTEXITCODE -ne 0) { Write-Error "Bundled python -m venv failed (exit $LASTEXITCODE). The install_only runtime must support venv - do NOT substitute another python."; exit 1 }
$venvPython = "$venvDir\Scripts\python.exe"
if (-not (Test-Path $venvPython)) { Write-Error "venv python missing at $venvPython after creation"; exit 1 }

# -- 2. Install offline exactly as electron/venv-setup.js does ----------------
# Arg shapes mirror buildWheelInstallArgs / buildOpencvDedupeArgs so the build path
# and the pip-fallback path can't drift. --progress-bar raw is kept for parity (it
# only changes pip's output format).
Write-Host "`n[2/5] Installing wheel + deps offline from the wheelhouse (this is the slow part)..."
& $venvPython -m pip install --force-reinstall --no-compile --progress-bar raw `
    --no-index --find-links $wheelhouseDir -c $lockPath $wheel.FullName
if ($LASTEXITCODE -ne 0) { Write-Error "Offline wheel install failed (exit $LASTEXITCODE)"; exit 1 }

Write-Host "`n     Deduping OpenCV (contrib superset wins)..."
& $venvPython -m pip install --force-reinstall --no-deps --no-compile --progress-bar raw `
    --no-index --find-links $wheelhouseDir -c $lockPath opencv-contrib-python
if ($LASTEXITCODE -ne 0) { Write-Error "OpenCV dedupe install failed (exit $LASTEXITCODE)"; exit 1 }

# -- 3. Smoke-check the heavy natives import BEFORE archiving -----------------
Write-Host "`n[3/5] Smoke-checking native imports in the built venv..."
& $venvPython $smokeFile
if ($LASTEXITCODE -ne 0) { Write-Error "Native import smoke check FAILED in the freshly built venv - not archiving."; exit 1 }

# -- 4. Prove relocation: move the venv AND its base python, repoint, re-import
Write-Host "`n[4/5] Proving relocation (move venv + base python to new paths, repoint, re-import)..."
$relocDir    = "$outDir\relocation-test"
$relocVenv   = "$relocDir\venv"
$relocPython = "$relocDir\python"
New-Item -ItemType Directory -Force -Path $relocDir | Out-Null
Copy-Item $venvDir    $relocVenv   -Recurse -Force
Copy-Item $runtimeDir $relocPython -Recurse -Force

# Repoint the moved venv's pyvenv.cfg using the SAME function the runtime uses, so
# this gate exercises the exact relocation code that ships.
$moduleForNode = ($root -replace '\\', '/') + '/electron/prebuilt-env'
$relocCfg = "$relocVenv\pyvenv.cfg"
$nodeRewrite = "const fs=require('fs');const {rewritePyvenvCfg}=require('$moduleForNode');" +
    "const p=process.argv[1],b=process.argv[2];fs.writeFileSync(p,rewritePyvenvCfg(fs.readFileSync(p,'utf8'),b));"
node -e $nodeRewrite $relocCfg $relocPython
if ($LASTEXITCODE -ne 0) { Write-Error "pyvenv.cfg rewrite (node electron/prebuilt-env.js) failed"; exit 1 }

$relocVenvPython = "$relocVenv\Scripts\python.exe"
& $relocVenvPython $smokeFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "RELOCATION FAILED - native imports break after moving the venv and repointing pyvenv.cfg. The prebuilt-env approach is not safe as-is; investigate the failing import before shipping."
    exit 1
}
Write-Host "     Relocation proven: natives import from the moved venv."
Remove-Item $relocDir -Recurse -Force

# -- 5. Archive + version marker ---------------------------------------------
Write-Host "`n[5/5] Archiving venv to $archivePath..."
Write-Host "     (~31k files - this can take a few minutes; exclude build\ from Windows Defender to speed up rebuilds)"
tar -czf $archivePath -C $outDir venv
if ($LASTEXITCODE -ne 0) { Write-Error "tar archive failed (exit $LASTEXITCODE)"; exit 1 }
Set-Content -Path $versionMarker -Value $wheelVersion -NoNewline
Remove-Item $smokeFile -Force -ErrorAction SilentlyContinue

$archiveSizeMb = [math]::Round((Get-Item $archivePath).Length / 1MB, 1)
Write-Host "`nPrebuilt env ready:"
Write-Host "  archive : $archivePath ($archiveSizeMb MB)"
Write-Host "  version : $wheelVersion"
