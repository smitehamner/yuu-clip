'use strict';

// Command construction for first-run venv setup, split out from main.js so it
// can be unit-tested without loading Electron. main.js supplies the real paths
// and runs these via runCmd; tests assert the arg shapes.

// pip.exe cannot replace itself on Windows — it exits 1 with "To modify pip,
// please run python -m pip" the moment PyPI ships a newer pip than the bundled
// runtime's. The upgrade MUST therefore go through `python -m pip` (run with
// VENV_PYTHON), never the pip.exe wrapper. Regressing this breaks every fresh
// install as soon as pip publishes a new release (observed 2026-07-05).
function buildPipUpgradeArgs() {
  return ['-m', 'pip', 'install', '--upgrade', 'pip'];
}

// Constrain to the bundled lock (when present) so every install resolves the
// exact base-dep versions we tested (see requirements.lock / scripts/lock-deps.ps1).
function buildWheelInstallArgs(wheelPath, lockPath = null) {
  const args = ['install', '--force-reinstall', '--progress-bar', 'raw'];
  if (lockPath) args.push('-c', lockPath);
  args.push(wheelPath);
  return args;
}

module.exports = { buildPipUpgradeArgs, buildWheelInstallArgs };
