'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bytesNeeded, hasEnoughSpace, formatGb, DEFAULT_HEADROOM_GB } = require('../disk-space');

test('bytesNeeded adds the default headroom to the model size', () => {
  // 4.7 GB model + 2 GB headroom = 6.7 GB, rounded up to whole bytes.
  assert.equal(bytesNeeded(4.7), Math.ceil(6.7 * 1e9));
});

test('bytesNeeded honours an explicit headroom', () => {
  assert.equal(bytesNeeded(4, 1), 5e9);
});

test('bytesNeeded treats a missing size as zero (headroom only)', () => {
  assert.equal(bytesNeeded(undefined), DEFAULT_HEADROOM_GB * 1e9);
});

test('hasEnoughSpace is true only at or above the needed bytes', () => {
  assert.equal(hasEnoughSpace(6.7e9, bytesNeeded(4.7)), true);
  assert.equal(hasEnoughSpace(bytesNeeded(4.7), bytesNeeded(4.7)), true);  // exact boundary
  assert.equal(hasEnoughSpace(3e9, bytesNeeded(4.7)), false);
});

test('formatGb renders bytes as a one-decimal gigabyte string', () => {
  assert.equal(formatGb(6.7e9), '6.7');
  assert.equal(formatGb(0), '0.0');
});
