'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { formatPipLine, cleanupStalePartFiles } = require('../install');

test('formats a Progress line into a percentage status', () => {
  assert.equal(formatPipLine('Progress 50 of 100'), 'Downloading… 50%');
});

test('a zero-total Progress line yields no status', () => {
  assert.equal(formatPipLine('Progress 0 of 0'), null);
});

test('a Collecting line passes through unchanged when short', () => {
  assert.equal(formatPipLine('Collecting foo'), 'Collecting foo');
});

test('a long recognized line is truncated with an ellipsis', () => {
  const line = 'Collecting ' + 'x'.repeat(60);
  const result = formatPipLine(line);
  assert.equal(result.length, 60);
  assert.equal(result.endsWith('…'), true);
});

test('unrecognized noise lines yield no status', () => {
  assert.equal(formatPipLine('Requirement already satisfied: foo'), null);
});

// ── cleanupStalePartFiles (stranded-download sweep, 5.2) ──────────────────────

function withTempModelsDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yuu-models-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('removes stranded .part files and leaves everything else alone', () => {
  withTempModelsDir(dir => {
    fs.writeFileSync(path.join(dir, 'model.gguf.part'), 'partial');
    fs.writeFileSync(path.join(dir, 'model.gguf'), 'complete');
    const removed = cleanupStalePartFiles(dir);
    assert.deepEqual(removed.sort(), ['model.gguf.part']);
    assert.equal(fs.existsSync(path.join(dir, 'model.gguf.part')), false);
    assert.equal(fs.existsSync(path.join(dir, 'model.gguf')), true);
  });
});

test('a directory with no .part files removes nothing', () => {
  withTempModelsDir(dir => {
    fs.writeFileSync(path.join(dir, 'model.gguf'), 'complete');
    assert.deepEqual(cleanupStalePartFiles(dir), []);
    assert.equal(fs.existsSync(path.join(dir, 'model.gguf')), true);
  });
});

test('a missing modelsDir is a no-op, not a crash', () => {
  const missing = path.join(os.tmpdir(), 'yuu-models-does-not-exist-xyz');
  assert.deepEqual(cleanupStalePartFiles(missing), []);
});
