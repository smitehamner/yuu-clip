'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decideSetupMode } = require('../startup-mode');

test('first run shows the wizard in initial mode', () => {
  assert.deepEqual(
    decideSetupMode({ firstRun: true, ffmpegOk: true, storedSchema: 3, schemaVersion: 3 }),
    { show: true, mode: 'initial' }
  );
});

test('up-to-date returning user with FFmpeg present does not show the wizard', () => {
  assert.deepEqual(
    decideSetupMode({ firstRun: false, ffmpegOk: true, storedSchema: 3, schemaVersion: 3 }),
    { show: false, mode: 'initial' }
  );
});

test('outdated schema with FFmpeg present shows the wizard in update mode', () => {
  assert.deepEqual(
    decideSetupMode({ firstRun: false, ffmpegOk: true, storedSchema: 2, schemaVersion: 3 }),
    { show: true, mode: 'update' }
  );
});

test('missing FFmpeg with a current schema shows the wizard in initial mode', () => {
  assert.deepEqual(
    decideSetupMode({ firstRun: false, ffmpegOk: false, storedSchema: 3, schemaVersion: 3 }),
    { show: true, mode: 'initial' }
  );
});

test('a missing storedSchema defaults to 1 and counts as outdated', () => {
  assert.deepEqual(
    decideSetupMode({ firstRun: false, ffmpegOk: true, storedSchema: undefined, schemaVersion: 3 }),
    { show: true, mode: 'update' }
  );
});
