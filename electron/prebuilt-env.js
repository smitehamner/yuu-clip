'use strict';

// Pure logic for the shipped prebuilt Python environment, split out of main.js so
// it can be unit-tested without Electron (like venv-setup.js / startup-mode.js).
//
// Packaged builds ship the analysis venv as a prebuilt .tar.gz built at build time
// (scripts/windows-release/build-prebuilt-env.ps1) against the exact bundled python-build-standalone
// runtime. First run unpacks it instead of running pip - no resolution, no compile.
// A venv built at one path only works after being moved once its pyvenv.cfg is
// repointed at the bundled Python's real (installed) location: that repoint is
// rewritePyvenvCfg.

const pathWin32 = require('path').win32;

// The pyvenv.cfg that `python-build-standalone -m venv` writes records the base
// runtime with absolute-path keys. Verified against a real sample (2026-07-10) the
// keys are `home` (base dir) and `executable` (base python.exe); older/other CPython
// venvs additionally write `base-prefix` / `base-exec-prefix` / `base-executable`,
// so we rewrite any of those that are present and leave `command`, `version`, and
// `include-system-site-packages` untouched. `home` is the one the launcher actually
// uses to locate the runtime after the venv is moved; the rest are provenance we
// keep consistent so nothing points at the throwaway build path.
function rewritePyvenvCfg(cfgText, basePythonDir) {
  const basePythonExe = pathWin32.join(basePythonDir, 'python.exe');
  const dirKeys = ['home', 'base-prefix', 'base-exec-prefix'];
  const exeKeys = ['executable', 'base-executable'];
  let out = cfgText;
  for (const key of dirKeys) {
    out = replaceCfgValue(out, key, basePythonDir);
  }
  for (const key of exeKeys) {
    out = replaceCfgValue(out, key, basePythonExe);
  }
  return out;
}

function replaceCfgValue(cfgText, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^(\\s*${escaped}\\s*=\\s*).*$`, 'm');
  return cfgText.replace(pattern, `$1${value}`);
}

// Which venv-provisioning path first-run should take. Packaged builds carry the
// prebuilt archive; dev/unpackaged builds don't and fall back to the pip-from-
// wheelhouse flow. A version mismatch (user upgraded) re-extracts a fresh env.
function decidePrebuiltEnvAction({ envArchivePresent, installedVersion, bundledVersion, venvExists }) {
  if (!envArchivePresent) return 'pip-fallback';
  if (venvExists && bundledVersion && installedVersion === bundledVersion) return 'use-existing';
  return 'extract';
}

// Opt-in extras a user pip-installs INTO the venv (GPU cuda-libs today) are destroyed
// by the wholesale re-extract on every upgrade, with no path that reinstalls them -
// so a user who enabled GPU acceleration silently drops to CPU transcription and faces
// a ~1GB re-download each release (found 2026-07-25; mirrors the .gguf model-persistence
// fix). Given what was present in the OLD venv before the wipe, this returns the slugs
// to reinstall into the fresh venv so the choice survives the upgrade. Extend the checks
// here when a new opt-in venv extra is added.
function extrasToRestoreAfterExtract({ hadCudaLibs }) {
  const slugs = [];
  if (hadCudaLibs) slugs.push('cuda-libs');
  return slugs;
}

module.exports = { rewritePyvenvCfg, decidePrebuiltEnvAction, extrasToRestoreAfterExtract };
