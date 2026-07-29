'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildWheelInstallArgs, buildOpencvDedupeArgs, buildPipInstallArgs, installVenvExtras } = require('../venv-setup');

test('wheel install constrains to the lock when a lock path is given', () => {
  const args = buildWheelInstallArgs('C:\\r\\yuu_clip-0.1.15-py3-none-any.whl', 'C:\\r\\requirements.lock');
  assert.deepEqual(args, [
    'install', '--force-reinstall', '--no-compile', '--progress-bar', 'raw',
    '-c', 'C:\\r\\requirements.lock',
    'C:\\r\\yuu_clip-0.1.15-py3-none-any.whl',
  ]);
});

test('wheel install omits the constraint when no lock is present', () => {
  const args = buildWheelInstallArgs('C:\\r\\yuu_clip-0.1.15-py3-none-any.whl');
  assert.ok(!args.includes('-c'));
  assert.equal(args[args.length - 1], 'C:\\r\\yuu_clip-0.1.15-py3-none-any.whl');
});

test('wheelhouse dir installs offline via --no-index --find-links', () => {
  const args = buildWheelInstallArgs(
    'C:\\r\\yuu_clip-0.1.15-py3-none-any.whl',
    'C:\\r\\requirements.lock',
    'C:\\r\\wheelhouse',
  );
  assert.deepEqual(args, [
    'install', '--force-reinstall', '--no-compile', '--progress-bar', 'raw',
    '--no-index', '--find-links', 'C:\\r\\wheelhouse',
    '-c', 'C:\\r\\requirements.lock',
    'C:\\r\\yuu_clip-0.1.15-py3-none-any.whl',
  ]);
  // --no-index must sit right before its find-links dir so pip never reaches PyPI.
  const noIndex = args.indexOf('--no-index');
  assert.equal(args[noIndex + 1], '--find-links');
  assert.equal(args[noIndex + 2], 'C:\\r\\wheelhouse');
});

test('no wheelhouse dir means no --no-index (online fallback for dev builds)', () => {
  const args = buildWheelInstallArgs('C:\\r\\yuu_clip-0.1.15-py3-none-any.whl', 'C:\\r\\requirements.lock');
  assert.ok(!args.includes('--no-index'));
  assert.ok(!args.includes('--find-links'));
});

test('opencv dedupe reinstalls the contrib superset last with --no-deps, offline', () => {
  const args = buildOpencvDedupeArgs('C:\\r\\requirements.lock', 'C:\\r\\wheelhouse');
  assert.deepEqual(args, [
    'install', '--force-reinstall', '--no-deps', '--no-compile', '--progress-bar', 'raw',
    '--no-index', '--find-links', 'C:\\r\\wheelhouse',
    '-c', 'C:\\r\\requirements.lock',
    'opencv-contrib-python',
  ]);
});

test('opencv dedupe must never pull dependencies (would reintroduce opencv-python)', () => {
  const args = buildOpencvDedupeArgs('C:\\r\\requirements.lock', 'C:\\r\\wheelhouse');
  assert.ok(args.includes('--no-deps'));
  assert.equal(args[args.length - 1], 'opencv-contrib-python');
});

test('opencv dedupe falls back to constrained PyPI when no wheelhouse (dev builds)', () => {
  const args = buildOpencvDedupeArgs('C:\\r\\requirements.lock');
  assert.ok(!args.includes('--no-index'));
  assert.ok(!args.includes('--find-links'));
  assert.deepEqual(args.slice(-3), ['-c', 'C:\\r\\requirements.lock', 'opencv-contrib-python']);
});

test('pip install args request one package per install with a raw progress bar', () => {
  assert.deepEqual(
    buildPipInstallArgs(['nvidia-cublas-cu12', 'nvidia-cudnn-cu12']),
    ['install', '--progress-bar', 'raw', 'nvidia-cublas-cu12', 'nvidia-cudnn-cu12'],
  );
});

// installVenvExtras is the call-site logic behind the venv-restore-after-upgrade
// path (electron/main.js::restoreVenvExtrasAfterExtract) - runCmd is injected so
// this exercises the actual invocation (python bin, args, per-slug tolerance),
// not just the pure arg builder above.
test('installVenvExtras invokes runCmd with -m pip install for each known slug', async () => {
  const calls = [];
  const fakeRunCmd = async (pythonBin, args) => { calls.push({ pythonBin, args }); };
  const catalog = { 'cuda-libs': { packages: ['nvidia-cublas-cu12', 'nvidia-cudnn-cu12'] } };

  await installVenvExtras(fakeRunCmd, 'C:\\venv\\python.exe', ['cuda-libs'], catalog);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].pythonBin, 'C:\\venv\\python.exe');
  assert.deepEqual(calls[0].args, [
    '-m', 'pip', 'install', '--progress-bar', 'raw',
    'nvidia-cublas-cu12', 'nvidia-cudnn-cu12',
  ]);
});

test('installVenvExtras skips a slug missing from the catalog without calling runCmd', async () => {
  const calls = [];
  const fakeRunCmd = async (...args) => { calls.push(args); };

  await installVenvExtras(fakeRunCmd, 'python', ['unknown-slug'], {});

  assert.equal(calls.length, 0);
});

test('installVenvExtras tolerates one slug failing and still installs the rest', async () => {
  const attempted = [];
  const fakeRunCmd = async (pythonBin, args) => {
    attempted.push(args[args.length - 1]);
    if (args[args.length - 1] === 'fails-pkg') throw new Error('network error');
  };
  const catalog = {
    broken: { packages: ['fails-pkg'] },
    ok: { packages: ['fine-pkg'] },
  };
  const errors = [];
  const successes = [];

  await installVenvExtras(fakeRunCmd, 'python', ['broken', 'ok'], catalog, {
    onError: (slug, err) => errors.push({ slug, message: err.message }),
    onSuccess: (slug) => successes.push(slug),
  });

  assert.deepEqual(attempted, ['fails-pkg', 'fine-pkg']);
  assert.deepEqual(errors, [{ slug: 'broken', message: 'network error' }]);
  assert.deepEqual(successes, ['ok']);
});
