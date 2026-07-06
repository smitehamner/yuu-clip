'use strict';

// Command construction for first-run venv setup, split out from main.js so it
// can be unit-tested without loading Electron. main.js supplies the real paths
// and runs these via runCmd; tests assert the arg shapes.

// Packaged first-run installs the base pipeline OFFLINE from a bundled wheelhouse
// (scripts/fetch-wheelhouse.ps1) so a slow/firewalled/proxied network can't fail
// the very first launch. A `wheelhouseDir` triggers `--no-index --find-links`;
// without it (dev/unpackaged builds) pip falls back to PyPI. `lockPath` constrains
// to the exact base-dep versions we tested (requirements.lock / scripts/lock-deps.ps1).
//
// There is deliberately NO pip self-upgrade step: the bundled runtime's pip already
// installs wheels from a find-links dir, and upgrading pip from PyPI reintroduced a
// network dependency on the very first launch (the thing this offline path exists to
// remove). If a pip upgrade is ever genuinely needed, it MUST go through
// `python -m pip` — pip.exe cannot replace itself on Windows (it exits 1 with
// "To modify pip, please run python -m pip", observed 2026-07-05) — and pull from the
// wheelhouse, never PyPI.
function buildWheelInstallArgs(wheelPath, lockPath = null, wheelhouseDir = null) {
  const args = ['install', '--force-reinstall', '--progress-bar', 'raw'];
  if (wheelhouseDir) args.push('--no-index', '--find-links', wheelhouseDir);
  if (lockPath) args.push('-c', lockPath);
  args.push(wheelPath);
  return args;
}

module.exports = { buildWheelInstallArgs };
