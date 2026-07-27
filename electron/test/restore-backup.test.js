'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildRestoreArgs,
  parseRestoreExit,
  RESTORE_EXIT_PROJECT_EXISTS,
} = require('../restore-backup');

test('buildRestoreArgs targets the yuu_clip.cli restore command with the paths', () => {
  const args = buildRestoreArgs('C:\\b.zip', 'D:\\proj', false);
  assert.deepEqual(args, [
    '-m', 'yuu_clip.cli', 'restore', '--archive', 'C:\\b.zip', '--project', 'D:\\proj',
  ]);
});

test('buildRestoreArgs appends --overwrite only when overwriting', () => {
  assert.equal(buildRestoreArgs('a', 'b', false).includes('--overwrite'), false);
  assert.equal(buildRestoreArgs('a', 'b', true).includes('--overwrite'), true);
});

test('parseRestoreExit maps exit 0 to success', () => {
  assert.deepEqual(parseRestoreExit(0, ''), { ok: true });
});

test('parseRestoreExit maps the project-exists code to a retryable result', () => {
  assert.deepEqual(
    parseRestoreExit(RESTORE_EXIT_PROJECT_EXISTS, 'ignored'),
    { ok: false, code: 'project_exists' },
  );
});

test('parseRestoreExit surfaces stderr for other failures', () => {
  const result = parseRestoreExit(1, '  This file is not a valid yuu-clip backup.  ');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'This file is not a valid yuu-clip backup.');
  assert.equal(result.code, undefined);
});

test('parseRestoreExit falls back to a code message when stderr is empty', () => {
  assert.deepEqual(parseRestoreExit(1, ''), { ok: false, error: 'Restore failed (exit code 1)' });
});

// Guard the wiring in main.js so the handler, launch-skip, and preload bridge
// can't be silently dropped (main.js can't be required directly - it needs the
// electron runtime - so assert on its source, as startup-mode/desktop-shortcut do).
test('main.js registers the restore IPC handler and skips config write on restore', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(src, /ipcMain\.handle\('setup:restore-backup'/);
  assert.match(src, /if \(cfg\.restored\)/);
});

test('setup-preload exposes restoreBackup', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'setup-preload.js'), 'utf8');
  assert.match(src, /restoreBackup:.*setup:restore-backup/);
});

// A restore failure's stderr detail (parseRestoreExit's `result.error`) must reach the
// setup log, not just the bare exit code - otherwise a "restore failed" bug report has
// no way to say why. Guard both failure surfaces: the process exiting non-zero, and the
// process failing to spawn at all (found in the logging-coverage pass 2026-07-26).
test('main.js logs the restore failure detail, not just the exit code', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const fnMatch = src.match(/function runRestore\([\s\S]*?\r?\n}\r?\n/);
  assert.ok(fnMatch, 'runRestore function not found in main.js');
  const fnSrc = fnMatch[0];
  assert.match(fnSrc, /logSetup\(`Restore failed to spawn: \$\{err\.message\}`\)/);
  assert.match(fnSrc, /logSetup\(`Restore failed \(code \$\{code\}\): \$\{tail\}`\)/);
});
