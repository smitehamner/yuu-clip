# build-release.ps1 - build the yuu-clip installer
# Usage: .\scripts\build-release.ps1 [-Version 0.2.0]
param(
    [string]$Version = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent

# ── 0. Bump version if requested ─────────────────────────────────────────────
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

# ── 1. Warn if working tree is dirty ────────────────────────────────────────
$dirty = git -C $root status --porcelain
if ($dirty) {
    Write-Warning "Git working tree is dirty. Commit or stash changes before releasing."
    $ans = Read-Host "Continue anyway? (y/N)"
    if ($ans -notmatch '^[Yy]') { exit 1 }
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
python -c "import build" 2>$null
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
    $staleMsg = python "$root\scripts\check_wheel_deps.py" $staleWhl.FullName "$root\pyproject.toml"
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
    Write-Error "requirements.lock missing - run scripts\lock-deps.ps1 first (packaged installs are constrained to it)."
    exit 1
}
Write-Host "Dependency lock present: $lockPath"

# ── 4. Fetch the bundled Python runtime (cached after first build) ─────────
Write-Host "`nFetching bundled Python runtime..."
& "$root\scripts\fetch-python-runtime.ps1"

# ── 4a. Build the offline dependency wheelhouse (cached; needs the runtime) ──
# So first-run installs the base pipeline offline (--no-index) instead of hitting
# PyPI at launch. Uses the bundled runtime's python for matching wheels.
Write-Host "`nBuilding offline dependency wheelhouse..."
& "$root\scripts\fetch-wheelhouse.ps1"

# ── 4b. Fetch the bundled GPL FFmpeg runtime + matching source archives ────
Write-Host "`nFetching bundled FFmpeg runtime..."
& "$root\scripts\fetch-ffmpeg-runtime.ps1"

$sourceOutDir = "$root\build\installer"
New-Item -ItemType Directory -Force -Path $sourceOutDir | Out-Null
Copy-Item "$root\build\ffmpeg-source\*" $sourceOutDir -Force
Write-Host "FFmpeg source archives copied to $sourceOutDir (ship alongside the installer)"

# ── 4c. Fetch the bundled MIT llama.cpp llama-server runtime (Vulkan + CPU) ──
Write-Host "`nFetching bundled llama-server runtime..."
& "$root\scripts\fetch-llama-server-runtime.ps1"

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
