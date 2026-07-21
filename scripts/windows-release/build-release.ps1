# build-release.ps1 - build the yuu-clip installer
# Usage: .\scripts\build-release.ps1 [-Version 0.2.0]
param(
    [string]$Version = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent  # repo root (script lives in scripts/windows-release/)

# ── 0. Warn if working tree is dirty ────────────────────────────────────────
# Runs BEFORE the version bump: the bump commits pyproject.toml + the electron
# manifests, so checking afterwards means you only learn the tree was dirty once
# there is already a commit to unwind.
$dirty = git -C $root status --porcelain
if ($dirty) {
    Write-Warning "Git working tree is dirty. Commit or stash changes before releasing."
    $ans = Read-Host "Continue anyway? (y/N)"
    if ($ans -notmatch '^[Yy]') { exit 1 }
}

# ── 0b. Regenerate committed source-derived artifacts, fail on drift ─────────
# The wheel packages whatever is committed under yuu_clip/web/static/, and the
# Electron build ships the committed setup bundle + shared data - so a human who
# edited a *.js module, an index.html partial, a help doc, or a catalog source but
# forgot to run the generator would ship a STALE UI with no error. The drift-guard
# unit tests catch this, but only if someone runs them; the build must not depend on
# that. Regenerate every committed artifact here and abort if any changed, so the
# "did you run yuu-dev bundle?" step can never be silently missed. Runs BEFORE the
# version bump so a stale tree aborts before any commit. (notices is left to its own
# drift test + the lock check below, since regenerating it needs the full dep set.)
Write-Host "`nRegenerating committed UI artifacts (bundle / shared-data / help-docs)..."

# The esbuild bundle needs the root JS toolchain. Install it if absent so the
# regeneration below can't silently skip (a skip would let a stale bundle through -
# the drift guard itself skips when esbuild is missing, exactly the hole this closes).
python -c "import sys; from yuu_clip.dev.bundle import esbuild_available; sys.exit(0 if esbuild_available() else 1)"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Root JS toolchain missing - running 'npm ci' to install esbuild..."
    Push-Location $root
    npm ci
    Pop-Location
    if ($LASTEXITCODE -ne 0) { Write-Error "npm ci (root) failed - cannot regenerate the UI bundle"; exit 1 }
}

# Invoked as `python -m yuu_clip.dev` (not the `yuu-dev` shim) so this doesn't depend
# on the shim being on PATH - the same interpreter the rest of this script uses.
foreach ($gen in @('bundle', 'shared-data', 'help-docs')) {
    python -m yuu_clip.dev $gen
    if ($LASTEXITCODE -ne 0) { Write-Error "yuu-dev $gen failed - fix it before releasing"; exit 1 }
}

$artifactPaths = @(
    'yuu_clip/web/static/bundle.esm.js',
    'yuu_clip/web/static/index.html',
    'yuu_clip/web/static/shared',
    'yuu_clip/web/static/help',
    'electron/setup.bundle.js',
    'electron/shared'
)
$artifactDrift = git -C $root status --porcelain -- $artifactPaths
if ($artifactDrift) {
    Write-Error @"
Committed UI artifacts were STALE and have now been regenerated below. This is the
"you forgot to run yuu-dev bundle" case. Review the changes, commit them, then re-run
the build:

$artifactDrift

  git add $($artifactPaths -join ' ')
  git commit -m "Regenerate UI artifacts"
"@
    exit 1
}
Write-Host "Committed UI artifacts are current."

# ── 1. Bump version if requested ─────────────────────────────────────────────
if ($Version -eq "") {
    $pyprojectCurrent = Get-Content "$root\pyproject.toml" -Raw
    if ($pyprojectCurrent -match 'version\s*=\s*"([^"]+)"') { $currentVer = $Matches[1] } else { $currentVer = "?" }
    $Version = Read-Host "New version (current: $currentVer, Enter to keep)"
}

if ($Version -ne "") {
    if ($Version -notmatch '^\d+\.\d+\.\d+') {
        Write-Error "Version must be in x.y.z format (got: $Version)"
        exit 1
    }
    $pyprojectPath = "$root\pyproject.toml"

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)

    $newPyproject = (Get-Content $pyprojectPath -Raw) -replace '(?m)^version\s*=\s*"[^"]+"', "version = `"$Version`""
    [System.IO.File]::WriteAllText($pyprojectPath, $newPyproject, $utf8NoBom)

    # Update package.json AND package-lock.json together via npm, so both version
    # fields in the lock (root + packages."") match. Editing only package.json
    # leaves the lock stale, and the build's own npm step later re-syncs it -
    # leaving package-lock.json dirty in the working tree after every release.
    Push-Location "$root\electron"
    npm version $Version --no-git-tag-version --allow-same-version | Out-Null
    Pop-Location

    Write-Host "Version bumped to $Version in pyproject.toml, electron/package.json, and electron/package-lock.json"

    git -C $root add pyproject.toml electron/package.json electron/package-lock.json
    git -C $root commit -m "Bump version to $Version"
    Write-Host "Committed version bump."
}

# ── 2. Read version from pyproject.toml ─────────────────────────────────────
$pyproject = Get-Content "$root\pyproject.toml" -Raw
if ($pyproject -notmatch 'version\s*=\s*"([^"]+)"') {
    Write-Error "Could not find version in pyproject.toml"
    exit 1
}
$version = $Matches[1]
Write-Host "Building version: $version"

# ── 3. Stamp build date and build Python wheel ───────────────────────────────
$buildDate = (Get-Date -Format "yyyy-MM-dd")
$buildInfoPath = "$root\yuu_clip\_build_info.py"
[System.IO.File]::WriteAllText($buildInfoPath, "BUILD_DATE = `"$buildDate`"`n", [System.Text.UTF8Encoding]::new($false))
Write-Host "Build date stamped: $buildDate"

Write-Host "`nBuilding Python wheel..."
# Probe for build.__main__, not just `import build`: the repo's own build/ dir is
# an implicit namespace package that shadows a bare `import build` from the repo
# root, so a plain probe falsely passes and skips this install on a fresh venv -
# then `python -m build` below resolves the empty build/ dir and dies. The real
# PyPA build package (regular, with __init__.py) then wins over the namespace dir.
python -c "import build.__main__" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing missing build backend (pip install build)..."
    python -m pip install build
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to install 'build'"; exit 1 }
}
$wheelDir = "$root\build\wheel"
# Warn (don't block) if the wheel we're about to delete was stale - a wheel built
# before a dependency changed silently omits new packages, so a hand-run install
# test with it would have been misleading. The rebuild below always produces fresh.
$staleWhl = Get-ChildItem "$wheelDir\*.whl" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($staleWhl) {
    $staleMsg = python "$PSScriptRoot\check_wheel_deps.py" $staleWhl.FullName "$root\pyproject.toml"
    if ($LASTEXITCODE -ne 0) { Write-Warning $staleMsg }
}
Remove-Item "$wheelDir\*.whl" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $wheelDir | Out-Null
Push-Location $root
python -m build --wheel --outdir $wheelDir
Pop-Location

$whl = Get-ChildItem "$wheelDir\*.whl" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $whl) {
    Write-Error "No .whl found in build/wheel/ after build"
    exit 1
}
Write-Host "Wheel: $($whl.FullName)"

[System.IO.File]::WriteAllText($buildInfoPath, "BUILD_DATE = `"dev`"`n", [System.Text.UTF8Encoding]::new($false))
Write-Host "Build date reset to dev"

# ── 3b. Ensure the dependency lock is present (bundled to constrain user installs) ──
$lockPath = "$root\requirements.lock"
if (-not (Test-Path $lockPath)) {
    Write-Error "requirements.lock missing - run yuu-dev lock-deps first (packaged installs are constrained to it)."
    exit 1
}
Write-Host "Dependency lock present: $lockPath"

# ── 4. Fetch the bundled Python runtime (cached after first build) ─────────
Write-Host "`nFetching bundled Python runtime..."
& "$PSScriptRoot\fetch-python-runtime.ps1"

# ── 4a. Build the offline dependency wheelhouse (cached; needs the runtime) ──
# So first-run installs the base pipeline offline (--no-index) instead of hitting
# PyPI at launch. Uses the bundled runtime's python for matching wheels.
Write-Host "`nBuilding offline dependency wheelhouse..."
& "$PSScriptRoot\fetch-wheelhouse.ps1"

# ── 4a-bis. Assemble the prebuilt Python env (needs the wheel + wheelhouse) ──
# Ships the finished venv so first-run unpacks an archive instead of running pip.
# Includes a build-time relocation proof that fails the build if a moved venv
# can't import the heavy natives (see scripts/build-prebuilt-env.ps1).
Write-Host "`nAssembling prebuilt Python env..."
& "$PSScriptRoot\build-prebuilt-env.ps1"
if ($LASTEXITCODE -ne 0) { Write-Error "Prebuilt env assembly failed (exit $LASTEXITCODE)"; exit 1 }

# ── 4b. Fetch the bundled GPL FFmpeg runtime + matching source archives ────
Write-Host "`nFetching bundled FFmpeg runtime..."
& "$PSScriptRoot\fetch-ffmpeg-runtime.ps1"

$sourceOutDir = "$root\build\installer"
New-Item -ItemType Directory -Force -Path $sourceOutDir | Out-Null
Copy-Item "$root\build\ffmpeg-source\*" $sourceOutDir -Force
Write-Host "FFmpeg source archives copied to $sourceOutDir (ship alongside the installer)"

# ── 4c. Fetch the bundled MIT llama.cpp llama-server runtime (Vulkan + CPU) ──
Write-Host "`nFetching bundled llama-server runtime..."
& "$PSScriptRoot\fetch-llama-server-runtime.ps1"

# ── 5. npm ci + npm run dist ─────────────────────────────────────────────────
# npm ci does a clean, deterministic install straight from package-lock.json, so
# a fresh checkout (no node_modules) builds without a manual `npm install`. It
# also fails loudly if the lock is out of sync with package.json - a guard
# against shipping a build whose deps drifted from the lock.
Write-Host "`nInstalling electron dependencies (npm ci)..."
Push-Location "$root\electron"
npm ci
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error "npm ci failed (exit $LASTEXITCODE). If package-lock.json is out of sync with package.json, run 'npm install' in electron/ and commit the updated lock."
    exit 1
}
Write-Host "Running electron-builder..."
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run dist
Pop-Location

# ── 6. Report output ────────────────────────────────────────────────────────
$exe = Get-ChildItem "$root\build\installer\*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($exe) {
    Write-Host "`nInstaller ready: $($exe.FullName)"
    Write-Host @"

Next steps:
  1. Install $($exe.Name) in a secondary account and run the smoke-test checklist
  2. git tag v$version && git push origin v$version
  3. Upload to GitHub Releases (or share directly)
"@
} else {
    Write-Warning "Build completed but no .exe found in build/installer/"
    exit 1
}
