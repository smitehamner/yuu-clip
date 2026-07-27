'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { redactPaths } = require('../logging');

test('redacts Windows username, keeps subpath', () => {
  assert.strictEqual(
    redactPaths('C:\\Users\\myser\\AppData\\Local\\yuu-clip\\venv\\Scripts\\python.exe'),
    'C:\\Users\\<user>\\AppData\\Local\\yuu-clip\\venv\\Scripts\\python.exe',
  );
});

test('redacts forward-slash and dotted usernames', () => {
  assert.strictEqual(redactPaths('C:/Users/jane.doe/Videos'), 'C:/Users/<user>/Videos');
});

test('redacts a username containing spaces without leaking the rest of the name', () => {
  assert.strictEqual(
    redactPaths('C:\\Users\\John Doe\\Videos\\yuu-clip'),
    'C:\\Users\\<user>\\Videos\\yuu-clip',
  );
  assert.strictEqual(redactPaths('/Users/Jane Smith/Library/app'), '/Users/<user>/Library/app');
});

test('a home path at the end of a line does not swallow the following line', () => {
  assert.strictEqual(
    redactPaths('Venv setup failed: boom\nUsing python: C:\\Users\\myser\nnext log line'),
    'Venv setup failed: boom\nUsing python: C:\\Users\\<user>\nnext log line',
  );
});

test('redacts linux and macos homes', () => {
  assert.strictEqual(redactPaths('/home/myser/.cache'), '/home/<user>/.cache');
  assert.strictEqual(redactPaths('/Users/myser/Library'), '/Users/<user>/Library');
});

test('leaves non-home paths untouched', () => {
  assert.strictEqual(redactPaths('D:\\apps\\yuu-clip\\log'), 'D:\\apps\\yuu-clip\\log');
});

test('is idempotent', () => {
  const once = redactPaths('C:\\Users\\myser\\x');
  assert.strictEqual(redactPaths(once), once);
});

test('coerces non-strings without throwing', () => {
  assert.strictEqual(redactPaths(42), '42');
});
