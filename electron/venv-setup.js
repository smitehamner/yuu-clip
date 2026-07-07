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

// mediapipe (vertical auto-framing) hard-depends on opencv-contrib-python while
// scenedetect hard-depends on opencv-python. pip has no "provides" mechanism, so
// BOTH install into the same site-packages/cv2 dir and whichever pip writes last
// wins. If plain opencv-python wins it strips the contrib-only modules back out
// from under mediapipe. Re-install the contrib superset LAST with --no-deps (so it
// touches nothing else) to make the outcome deterministic: contrib's cv2 always
// survives on disk and satisfies both packages. -c requirements.lock keeps it on
// the same version we pinned; the wheelhouse makes this offline-safe too.
function buildOpencvDedupeArgs(lockPath = null, wheelhouseDir = null) {
  const args = ['install', '--force-reinstall', '--no-deps', '--progress-bar', 'raw'];
  if (wheelhouseDir) args.push('--no-index', '--find-links', wheelhouseDir);
  if (lockPath) args.push('-c', lockPath);
  args.push('opencv-contrib-python');
  return args;
}

module.exports = { buildWheelInstallArgs, buildOpencvDedupeArgs };
