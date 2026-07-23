'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mergePathEntries } = require('../registry-path');

test('appends a new registry entry after the existing PATH', () => {
  assert.equal(
    mergePathEntries('C:\\venv\\Scripts', 'C:\\Windows\\System32'),
    'C:\\venv\\Scripts;C:\\Windows\\System32'
  );
});

test('preserves process-local entries not present in the registry', () => {
  const result = mergePathEntries('C:\\venv\\Scripts;C:\\Windows\\System32', 'C:\\Windows\\System32');
  assert.equal(result, 'C:\\venv\\Scripts;C:\\Windows\\System32');
});

test('does not duplicate an entry already on PATH (case-insensitive)', () => {
  const result = mergePathEntries('C:\\Windows\\system32', 'c:\\windows\\System32;C:\\Tools');
  assert.equal(result, 'C:\\Windows\\system32;C:\\Tools');
});

test('deduplicates registry entries against each other (HKLM + HKCU overlap)', () => {
  const result = mergePathEntries('', 'C:\\Tools;C:\\Tools;c:\\tools');
  assert.equal(result, 'C:\\Tools');
});

test('an empty current PATH just becomes the registry entries', () => {
  assert.equal(mergePathEntries('', 'C:\\Windows\\System32;C:\\Tools'), 'C:\\Windows\\System32;C:\\Tools');
});

test('an empty registryPath leaves the current PATH unchanged', () => {
  assert.equal(mergePathEntries('C:\\venv\\Scripts', ''), 'C:\\venv\\Scripts');
});

test('handles undefined/null inputs without throwing', () => {
  assert.equal(mergePathEntries(undefined, undefined), '');
  assert.equal(mergePathEntries(null, 'C:\\Tools'), 'C:\\Tools');
});
