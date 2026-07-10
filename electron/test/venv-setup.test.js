'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildWheelInstallArgs, buildOpencvDedupeArgs } = require('../venv-setup');

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
