'use strict';

// Command construction for first-run venv setup, split out from main.js so it
// can be unit-tested without loading Electron. main.js supplies the real paths
// and runs these via runCmd; tests assert the arg shapes.

// Packaged first-run installs the base pipeline OFFLINE from a bundled wheelhouse
// (scripts/windows-release/fetch-wheelhouse.ps1) so a slow/firewalled/proxied network can't fail
// the very first launch. A `wheelhouseDir` triggers `--no-index --find-links`;
// without it (dev/unpackaged builds) pip falls back to PyPI. `lockPath` constrains
// to the exact base-dep versions we tested (requirements.lock / yuu-dev lock-deps).
//
// There is deliberately NO pip self-upgrade step: the bundled runtime's pip already
// installs wheels from a find-links dir, and upgrading pip from PyPI reintroduced a
// network dependency on the very first launch (the thing this offline path exists to
// remove). If a pip upgrade is ever genuinely needed, it MUST go through
// `python -m pip` - pip.exe cannot replace itself on Windows (it exits 1 with
// "To modify pip, please run python -m pip", observed 2026-07-05) - and pull from the
// wheelhouse, never PyPI.
//
// --no-compile: skip .pyc byte-compilation at install time. On a fresh install this
// was ~11 of the ~12 minutes (single-threaded pyc gen over torch/transformers/etc.).
// Python recompiles each module lazily on first import, so the cost is spread across
// normal use instead of blocking first launch (measured 2026-07-10).
function buildWheelInstallArgs(wheelPath, lockPath = null, wheelhouseDir = null) {
  const args = ['install', '--force-reinstall', '--no-compile', '--progress-bar', 'raw'];
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
  const args = ['install', '--force-reinstall', '--no-deps', '--no-compile', '--progress-bar', 'raw'];
  if (wheelhouseDir) args.push('--no-index', '--find-links', wheelhouseDir);
  if (lockPath) args.push('-c', lockPath);
  args.push('opencv-contrib-python');
  return args;
}

// Shared by the two WIZARD_INSTALLABLE pip-install call sites (the wizard's
// "install this optional package now" IPC handler, and the post-upgrade
// venv-extras restore below) - was previously an inline literal duplicated at
// both sites.
function buildPipInstallArgs(packages) {
  return ['install', '--progress-bar', 'raw', ...packages];
}

// Restores each opt-in venv extra (today only cuda-libs) after the prebuilt-env
// upgrade path wipes and re-extracts the venv. `runCmd` is injected so this is
// unit-testable with a fake spawner - main.js passes the real one from
// install.js. Tolerant of a single extra's failure: the Settings/Analyze
// "Setup Warnings" chip already detects a missing extra and offers a one-click
// reinstall, so one network hiccup here must not abort the rest of the restore
// loop or the surrounding upgrade.
async function installVenvExtras(runCmd, pythonBin, slugs, catalog, { onLine, onStart, onSuccess, onError } = {}) {
  for (const slug of slugs) {
    const spec = catalog[slug];
    if (!spec) continue;
    if (onStart) onStart(slug);
    try {
      await runCmd(pythonBin, ['-m', 'pip', ...buildPipInstallArgs(spec.packages)], onLine);
      if (onSuccess) onSuccess(slug);
    } catch (err) {
      if (onError) onError(slug, err);
    }
  }
}

module.exports = { buildWheelInstallArgs, buildOpencvDedupeArgs, buildPipInstallArgs, installVenvExtras };
