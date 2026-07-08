'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePipRawProgress } = require('../pip-progress');

test('parses a mid-download Progress line into a fraction and percent label', () => {
  assert.deepEqual(parsePipRawProgress('Progress 262144 of 12430966'), {
    fraction: 262144 / 12430966,
    label: '2%',
  });
});

test('parses the zero-received boundary as 0% without throwing', () => {
  assert.deepEqual(parsePipRawProgress('Progress 0 of 12430966'), { fraction: 0, label: '0%' });
});

test('parses the fully-received boundary as 100%', () => {
  assert.deepEqual(parsePipRawProgress('Progress 12430966 of 12430966'), { fraction: 1, label: '100%' });
});

test('a zero-total Progress line yields null (division-by-zero guard)', () => {
  assert.equal(parsePipRawProgress('Progress 0 of 0'), null);
});

test('non-progress pip chatter yields null', () => {
  assert.equal(parsePipRawProgress('Collecting numpy'), null);
  assert.equal(parsePipRawProgress('Downloading numpy-2.5.1-cp312-cp312-win_amd64.whl (12.4 MB)'), null);
  assert.equal(parsePipRawProgress('Requirement already satisfied: six'), null);
  assert.equal(parsePipRawProgress(''), null);
});

test('malformed or partial progress lines never throw and yield null', () => {
  assert.equal(parsePipRawProgress('Progress'), null);
  assert.equal(parsePipRawProgress('Progress 50'), null);
  assert.equal(parsePipRawProgress('Progress 50 of'), null);
  assert.equal(parsePipRawProgress('Progress abc of 100'), null);
  assert.equal(parsePipRawProgress('Progress -5 of 100'), null);
  assert.equal(parsePipRawProgress(null), null);
  assert.equal(parsePipRawProgress(undefined), null);
  assert.equal(parsePipRawProgress(42), null);
});

test('is case-insensitive and tolerates surrounding whitespace', () => {
  assert.deepEqual(parsePipRawProgress('  progress 50 of 100  '), { fraction: 0.5, label: '50%' });
});
