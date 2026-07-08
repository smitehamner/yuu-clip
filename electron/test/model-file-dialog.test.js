'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { modelFileDialogOptions } = require('../model-file-dialog');

test('offers a .gguf filter first, then an all-files escape hatch', () => {
  const { filters } = modelFileDialogOptions();
  assert.deepEqual(filters[0], { name: 'Model files', extensions: ['gguf'] });
  assert.deepEqual(filters[1], { name: 'All files', extensions: ['*'] });
});

test('opens a single file, not a directory', () => {
  assert.deepEqual(modelFileDialogOptions().properties, ['openFile']);
});

test('passes a default path through only when given', () => {
  assert.equal(modelFileDialogOptions().defaultPath, undefined);
  assert.equal(modelFileDialogOptions('C:/models').defaultPath, 'C:/models');
});
