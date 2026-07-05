'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolveBundledFfmpegDir } = require('../ffmpeg-detect');

const BUNDLED_DIR = 'C:\\Program Files\\yuu-clip\\resources\\ffmpeg';

function existsSyncStub(presentFiles) {
  return (candidate) => presentFiles.includes(candidate);
}

test('dev mode (not packaged) never resolves a bundled dir, even if the files exist', () => {
  const existsSync = existsSyncStub([
    path.join(BUNDLED_DIR, 'ffmpeg.exe'),
    path.join(BUNDLED_DIR, 'ffprobe.exe'),
  ]);
  assert.equal(resolveBundledFfmpegDir(false, BUNDLED_DIR, existsSync), null);
});

test('packaged with both binaries present resolves the bundled dir', () => {
  const existsSync = existsSyncStub([
    path.join(BUNDLED_DIR, 'ffmpeg.exe'),
    path.join(BUNDLED_DIR, 'ffprobe.exe'),
  ]);
  assert.equal(resolveBundledFfmpegDir(true, BUNDLED_DIR, existsSync), BUNDLED_DIR);
});

test('packaged with only ffmpeg.exe present is not resolved (incomplete install)', () => {
  const existsSync = existsSyncStub([path.join(BUNDLED_DIR, 'ffmpeg.exe')]);
  assert.equal(resolveBundledFfmpegDir(true, BUNDLED_DIR, existsSync), null);
});

test('packaged with only ffprobe.exe present is not resolved (incomplete install)', () => {
  const existsSync = existsSyncStub([path.join(BUNDLED_DIR, 'ffprobe.exe')]);
  assert.equal(resolveBundledFfmpegDir(true, BUNDLED_DIR, existsSync), null);
});

test('packaged with neither binary present is not resolved', () => {
  const existsSync = existsSyncStub([]);
  assert.equal(resolveBundledFfmpegDir(true, BUNDLED_DIR, existsSync), null);
});
