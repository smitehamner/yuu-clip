'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPipUpgradeArgs, buildWheelInstallArgs } = require('../venv-setup');

test('pip upgrade goes through `python -m pip`, never pip.exe', () => {
  const args = buildPipUpgradeArgs();
  assert.deepEqual(args, ['-m', 'pip', 'install', '--upgrade', 'pip']);
  // The bug this guards: `pip.exe install --upgrade pip` can't replace itself on
  // Windows. The `-m pip` prefix is what routes the upgrade through python.
  assert.equal(args[0], '-m');
  assert.equal(args[1], 'pip');
  assert.ok(!args.some(a => a.includes('pip.exe')));
});

test('wheel install constrains to the lock when a lock path is given', () => {
  const args = buildWheelInstallArgs('C:\\r\\yuu_clip-0.1.15-py3-none-any.whl', 'C:\\r\\requirements.lock');
  assert.deepEqual(args, [
    'install', '--force-reinstall', '--progress-bar', 'raw',
    '-c', 'C:\\r\\requirements.lock',
    'C:\\r\\yuu_clip-0.1.15-py3-none-any.whl',
  ]);
});

test('wheel install omits the constraint when no lock is present', () => {
  const args = buildWheelInstallArgs('C:\\r\\yuu_clip-0.1.15-py3-none-any.whl');
  assert.ok(!args.includes('-c'));
  assert.equal(args[args.length - 1], 'C:\\r\\yuu_clip-0.1.15-py3-none-any.whl');
});
