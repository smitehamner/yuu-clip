'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rewritePyvenvCfg, decidePrebuiltEnvAction, extrasToRestoreAfterExtract } = require('../prebuilt-env');

// A real pyvenv.cfg captured from `build\python-runtime\python.exe -m venv` (the
// bundled python-build-standalone 3.12.13 runtime), 2026-07-10. The runtime writes
// `home`, `executable`, and `command` (plus version / include flag) - NOT the
// base-prefix keys other CPython builds emit.
const REAL_CFG =
  'home = C:\\code\\yuu-clip\\build\\python-runtime\r\n' +
  'include-system-site-packages = false\r\n' +
  'version = 3.12.13\r\n' +
  'executable = C:\\code\\yuu-clip\\build\\python-runtime\\python.exe\r\n' +
  'command = C:\\code\\yuu-clip\\build\\python-runtime\\python.exe -m venv C:\\tmp\\venvtest\r\n';

const RUNTIME_DIR = 'C:\\Users\\me\\AppData\\Local\\yuu-clip\\resources\\python';

test('rewrites home to the relocated base python dir', () => {
  const out = rewritePyvenvCfg(REAL_CFG, RUNTIME_DIR);
  assert.match(out, /^home = C:\\Users\\me\\AppData\\Local\\yuu-clip\\resources\\python$/m);
  assert.doesNotMatch(out, /^home =.*build\\python-runtime$/m);
});

test('rewrites executable to the relocated base python.exe', () => {
  const out = rewritePyvenvCfg(REAL_CFG, RUNTIME_DIR);
  assert.match(out, /^executable = C:\\Users\\me\\AppData\\Local\\yuu-clip\\resources\\python\\python\.exe$/m);
});

test('leaves version and include-system-site-packages untouched', () => {
  const out = rewritePyvenvCfg(REAL_CFG, RUNTIME_DIR);
  assert.match(out, /^version = 3\.12\.13$/m);
  assert.match(out, /^include-system-site-packages = false$/m);
});

test('leaves the historical command line untouched', () => {
  const out = rewritePyvenvCfg(REAL_CFG, RUNTIME_DIR);
  assert.match(out, /^command = C:\\code\\yuu-clip\\build\\python-runtime\\python\.exe -m venv C:\\tmp\\venvtest$/m);
});

test('preserves CRLF line endings and line count', () => {
  const out = rewritePyvenvCfg(REAL_CFG, RUNTIME_DIR);
  assert.equal(out.split('\r\n').length, REAL_CFG.split('\r\n').length);
});

test('tolerates irregular spacing around the equals sign', () => {
  const cfg = 'home=D:\\build\\python-runtime\n';
  const out = rewritePyvenvCfg(cfg, RUNTIME_DIR);
  assert.equal(out, 'home=C:\\Users\\me\\AppData\\Local\\yuu-clip\\resources\\python\n');
});

test('rewrites the base-prefix family when a CPython venv emits them', () => {
  const cfg =
    'home = D:\\build\\python-runtime\n' +
    'base-prefix = D:\\build\\python-runtime\n' +
    'base-exec-prefix = D:\\build\\python-runtime\n' +
    'base-executable = D:\\build\\python-runtime\\python.exe\n';
  const out = rewritePyvenvCfg(cfg, RUNTIME_DIR);
  assert.match(out, /^base-prefix = C:\\Users\\me\\AppData\\Local\\yuu-clip\\resources\\python$/m);
  assert.match(out, /^base-exec-prefix = C:\\Users\\me\\AppData\\Local\\yuu-clip\\resources\\python$/m);
  assert.match(out, /^base-executable = C:\\Users\\me\\AppData\\Local\\yuu-clip\\resources\\python\\python\.exe$/m);
});

test('packaged, matching version, venv present -> use existing', () => {
  assert.equal(decidePrebuiltEnvAction({
    envArchivePresent: true, installedVersion: '0.1.19', bundledVersion: '0.1.19', venvExists: true,
  }), 'use-existing');
});

test('packaged, version mismatch -> re-extract', () => {
  assert.equal(decidePrebuiltEnvAction({
    envArchivePresent: true, installedVersion: '0.1.18', bundledVersion: '0.1.19', venvExists: true,
  }), 'extract');
});

test('packaged, no venv -> extract', () => {
  assert.equal(decidePrebuiltEnvAction({
    envArchivePresent: true, installedVersion: null, bundledVersion: '0.1.19', venvExists: false,
  }), 'extract');
});

test('no archive (dev/unpackaged) -> pip fallback', () => {
  assert.equal(decidePrebuiltEnvAction({
    envArchivePresent: false, installedVersion: null, bundledVersion: null, venvExists: false,
  }), 'pip-fallback');
});

test('cuda-libs present before an upgrade wipe -> reinstall it after extract', () => {
  assert.deepEqual(extrasToRestoreAfterExtract({ hadCudaLibs: true }), ['cuda-libs']);
});

test('no cuda-libs before the wipe -> nothing to restore', () => {
  assert.deepEqual(extrasToRestoreAfterExtract({ hadCudaLibs: false }), []);
});
