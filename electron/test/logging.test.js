'use strict';

// rotateLogs/logSetup cover the ring-buffer log rotation and the write path;
// redactPaths itself (and its privacy guarantees) is covered separately in
// log-redact.test.js. SETUP_LOG is derived from process.env.APPDATA at
// require time (constants.js), so the override below must happen before the
// first require of constants/logging - node --test isolates each test file
// in its own process, so this does not leak into other test files.

const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'yuu-logging-'));
process.env.APPDATA = tempAppData;

const { rotateLogs, logSetup } = require('../logging');
const { SETUP_LOG } = require('../constants');

function clearLogs() {
  for (const p of fs.readdirSync(path.dirname(SETUP_LOG))) {
    fs.rmSync(path.join(path.dirname(SETUP_LOG), p), { force: true });
  }
}

beforeEach(() => {
  fs.mkdirSync(path.dirname(SETUP_LOG), { recursive: true });
  clearLogs();
});

after(() => {
  fs.rmSync(tempAppData, { recursive: true, force: true });
});

test('rotateLogs is a no-op when no log file exists yet', () => {
  rotateLogs();
  assert.equal(fs.existsSync(SETUP_LOG), false);
  assert.equal(fs.existsSync(`${SETUP_LOG}.1`), false);
});

test('rotateLogs shifts the current log to .1', () => {
  fs.writeFileSync(SETUP_LOG, 'current');
  rotateLogs();
  assert.equal(fs.existsSync(SETUP_LOG), false);
  assert.equal(fs.readFileSync(`${SETUP_LOG}.1`, 'utf8'), 'current');
});

test('rotateLogs shifts the whole ring by one and drops the oldest', () => {
  fs.writeFileSync(SETUP_LOG, 'current');
  fs.writeFileSync(`${SETUP_LOG}.1`, 'gen1');
  fs.writeFileSync(`${SETUP_LOG}.2`, 'gen2');
  fs.writeFileSync(`${SETUP_LOG}.3`, 'gen3');
  fs.writeFileSync(`${SETUP_LOG}.4`, 'gen4-oldest');
  rotateLogs();
  assert.equal(fs.readFileSync(`${SETUP_LOG}.1`, 'utf8'), 'current');
  assert.equal(fs.readFileSync(`${SETUP_LOG}.2`, 'utf8'), 'gen1');
  assert.equal(fs.readFileSync(`${SETUP_LOG}.3`, 'utf8'), 'gen2');
  assert.equal(fs.readFileSync(`${SETUP_LOG}.4`, 'utf8'), 'gen3');
  // gen4-oldest (the 5th generation) is dropped, not shifted to a .5
  assert.equal(fs.existsSync(`${SETUP_LOG}.5`), false);
});

test('logSetup writes a UTF-8 BOM on a fresh log', () => {
  logSetup('first line');
  const raw = fs.readFileSync(SETUP_LOG);
  assert.deepEqual(raw.subarray(0, 3), Buffer.from([0xef, 0xbb, 0xbf]));
});

test('logSetup does not re-write the BOM on a later append', () => {
  logSetup('first line');
  logSetup('second line');
  const raw = fs.readFileSync(SETUP_LOG);
  const bomCount = raw.toString('utf8').split('﻿').length - 1;
  assert.equal(bomCount, 1);
});

test('logSetup timestamps each line and appends rather than overwriting', () => {
  logSetup('first line');
  logSetup('second line');
  const lines = fs.readFileSync(SETUP_LOG, 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^﻿?\[\d{4}-\d{2}-\d{2}T.*\] first line$/);
  assert.match(lines[1], /^\[\d{4}-\d{2}-\d{2}T.*\] second line$/);
});

test('logSetup redacts a username in the message before writing to disk', () => {
  logSetup('Using python: C:\\Users\\John Doe\\venv\\python.exe');
  const written = fs.readFileSync(SETUP_LOG, 'utf8');
  assert.match(written, /C:\\Users\\<user>\\venv\\python\.exe/);
  assert.doesNotMatch(written, /John Doe/);
});
