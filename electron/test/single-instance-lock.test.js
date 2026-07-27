'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// A second near-simultaneous launch can race the first-run venv extraction into
// VENV_DIR/.incoming. main.js can't be required directly (it needs the electron
// runtime), so assert on its source the same way restore-backup/rerun-reload
// tests do.
const SRC = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('a failed requestSingleInstanceLock quits before any other startup work', () => {
  const lockCheck = SRC.indexOf('requestSingleInstanceLock()');
  assert.notEqual(lockCheck, -1, 'requestSingleInstanceLock() call not found in main.js');
  const guardBlock = SRC.slice(lockCheck, lockCheck + 200);
  assert.match(guardBlock, /app\.quit\(\)/);
  assert.match(guardBlock, /return;/);
});

test('second-instance handler focuses the existing window', () => {
  const handlerMatch = SRC.match(/app\.on\('second-instance',[\s\S]*?\n\}\);/);
  assert.ok(handlerMatch, "app.on('second-instance', ...) handler not found in main.js");
  assert.match(handlerMatch[0], /\.focus\(\)/);
  assert.match(handlerMatch[0], /isMinimized\(\)/);
});
