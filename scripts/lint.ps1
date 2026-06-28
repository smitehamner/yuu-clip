$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Ruff     = Join-Path $RepoRoot ".venv\Scripts\ruff.exe"

Push-Location $RepoRoot
try {
    & $Ruff check yuu_clip tests @args
} finally {
    Pop-Location
}
