# build-release.ps1 — build the yuu-clip installer
# Usage: .\scripts\build-release.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent

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

# ── 3. Build Python wheel ────────────────────────────────────────────────────
Write-Host "`nBuilding Python wheel..."
Push-Location $root
python -m build --wheel
Pop-Location

$whl = Get-ChildItem "$root\dist\*.whl" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $whl) {
    Write-Error "No .whl found in dist/ after build"
    exit 1
}
Write-Host "Wheel: $($whl.FullName)"

# ── 4. npm run dist ──────────────────────────────────────────────────────────
Write-Host "`nRunning electron-builder..."
Push-Location "$root\electron"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run dist
Pop-Location

# ── 5. Report output ────────────────────────────────────────────────────────
$exe = Get-ChildItem "$root\electron\dist\*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($exe) {
    Write-Host "`nInstaller ready: $($exe.FullName)"
    Write-Host @"

Next steps:
  1. Install $($exe.Name) in a secondary account and run the smoke-test checklist
  2. git tag v$version && git push origin v$version
  3. Upload to GitHub Releases (or share directly)
"@
} else {
    Write-Warning "Build completed but no .exe found in electron/dist/"
    exit 1
}
