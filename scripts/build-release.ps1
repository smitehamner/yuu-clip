# build-release.ps1 — build the yuu-clip installer
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
    $packagePath   = "$root\electron\package.json"

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)

    $newPyproject = (Get-Content $pyprojectPath -Raw) -replace '(?m)^version\s*=\s*"[^"]+"', "version = `"$Version`""
    [System.IO.File]::WriteAllText($pyprojectPath, $newPyproject, $utf8NoBom)

    $newPackage = (Get-Content $packagePath -Raw) -replace '"version"\s*:\s*"[^"]+"', "`"version`": `"$Version`""
    [System.IO.File]::WriteAllText($packagePath, $newPackage, $utf8NoBom)

    Write-Host "Version bumped to $Version in pyproject.toml and electron/package.json"

    git -C $root add pyproject.toml electron/package.json
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
$wheelDir = "$root\build\wheel"
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

# ── 4. npm run dist ──────────────────────────────────────────────────────────
Write-Host "`nRunning electron-builder..."
Push-Location "$root\electron"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run dist
Pop-Location

# ── 5. Report output ────────────────────────────────────────────────────────
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
