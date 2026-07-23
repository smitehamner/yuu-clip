'use strict';

// Regression guard: updateLoadingStatus() was defined to update the "Starting
// YuuClip…" loading screen's status line, but nothing ever called it - the
// line permanently read "Waiting for backend" for the whole boot. pollReady()
// can't be unit-tested directly (it needs a live BrowserWindow, pyProc, and
// the real backend HTTP endpoint - all Electron/main.js module state), so
// assert on the wiring the same way restore-backup.test.js does for main.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('pollReady calls updateLoadingStatus so the loading screen is not stuck on one line', () => {
  const pollReadyBody = SRC.slice(SRC.indexOf('function pollReady('), SRC.indexOf('function startupError('));
  assert.match(pollReadyBody, /updateLoadingStatus\(/);
});
