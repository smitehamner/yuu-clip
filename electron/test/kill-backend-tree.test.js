'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// killBackendTree is called from every shutdown path (normal close, all-windows-closed,
// uncaughtException, and process 'exit' - which cannot await, hence execFileSync/kill
// staying synchronous). If both the Windows `taskkill /T` tree-kill and the plain
// pyProc.kill() fallback fail, the backend (and any in-flight ffmpeg child) can be left
// orphaned with zero trace in the setup log. main.js can't be required directly (it needs
// the electron runtime), so assert on its source the same way restore-backup/
// rerun-reload tests do (found in the logging-coverage pass 2026-07-26).
const SRC = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const FN_SRC = SRC.match(/function killBackendTree\(\)[\s\S]*?\r?\n}\r?\n/)[0];

test('killBackendTree logs when both the tree-kill and the fallback kill fail', () => {
  assert.match(FN_SRC, /logSetup\(`Failed to kill backend process tree/);
});

test('the orphan log line is only reached from the fallback kill catch, not the outer one', () => {
  // taskkill exiting non-zero is the common/expected case (the tree is already gone),
  // so the outer catch must stay silent - only the double-failure (fallback kill also
  // throwing) is genuinely orphan-risk and worth a log line.
  const outerCatchIndex = FN_SRC.indexOf('} catch (_) {');
  const logIndex = FN_SRC.indexOf('logSetup(`Failed to kill backend process tree');
  assert.ok(outerCatchIndex !== -1 && logIndex > outerCatchIndex);
});
