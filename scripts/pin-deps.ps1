# pin-deps.ps1 — generate requirements.lock with SHA256 hashes (Windows)
# Run this whenever you want to update or initially generate the lockfile.
#
# Usage (from repo root, with venv active):
#   .\scripts\pin-deps.ps1              # pin all deps
#   .\scripts\pin-deps.ps1 --upgrade    # upgrade all to latest allowed versions
#
# If you get an execution policy error:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot

try {
    Write-Host "==> Installing pip-tools..." -ForegroundColor Cyan
    pip install --quiet "pip-tools>=7.4.0"

    Write-Host "==> Compiling requirements.lock with SHA256 hashes..." -ForegroundColor Cyan
    $extraArgs = $args  # pass through --upgrade etc.
    pip-compile `
        --generate-hashes `
        --output-file requirements.lock `
        --strip-extras `
        --no-emit-index-url `
        --no-emit-trusted-host `
        @extraArgs `
        requirements.in

    Write-Host ""
    Write-Host "==> Done. requirements.lock written." -ForegroundColor Green
    Write-Host ""
    Write-Host "    To install in a clean environment:"
    Write-Host "      pip install --require-hashes -r requirements.lock"
    Write-Host ""
    Write-Host "    Commit requirements.lock to version control."
    Write-Host "    It pins every transitive dependency and their SHA256 hashes."
}
finally {
    Pop-Location
}
