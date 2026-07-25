'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { isExternalUrlAllowed } = require('../open-external');

test('allows http and https URLs', () => {
  assert.equal(isExternalUrlAllowed('http://example.com'), true);
  assert.equal(isExternalUrlAllowed('https://huggingface.co/model'), true);
});

test('rejects file:// URLs', () => {
  assert.equal(isExternalUrlAllowed('file:///C:/Windows/System32/calc.exe'), false);
});

test('rejects other schemes and junk', () => {
  assert.equal(isExternalUrlAllowed('javascript:alert(1)'), false);
  assert.equal(isExternalUrlAllowed('mailto:a@b.com'), false);
  assert.equal(isExternalUrlAllowed('not a url'), false);
  assert.equal(isExternalUrlAllowed(''), false);
});

test('rejects non-string input', () => {
  assert.equal(isExternalUrlAllowed(null), false);
  assert.equal(isExternalUrlAllowed(undefined), false);
  assert.equal(isExternalUrlAllowed(42), false);
});
