'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatPipLine } = require('../install');

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
