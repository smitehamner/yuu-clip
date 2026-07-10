'use strict';

// WS4: the wizard offers the remote (Claude) backend only when the distribution gate
// is on. isRemoteAiEnabled mirrors Python's remote_ai_allowed - the build constant
// (false in shipped builds) OR a truthy YUU_REMOTE_AI env var.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isRemoteAiEnabled } = require('../constants');

test('gate is off by default (no env, shipped build constant false)', () => {
  assert.equal(isRemoteAiEnabled({}), false);
});

test('a truthy YUU_REMOTE_AI env var opens the gate', () => {
  for (const value of ['1', 'true', 'TRUE', 'yes', 'on', ' On ']) {
    assert.equal(isRemoteAiEnabled({ YUU_REMOTE_AI: value }), true, value);
  }
});

test('a non-truthy YUU_REMOTE_AI env var keeps the gate closed', () => {
  for (const value of ['0', 'false', 'no', 'off', '', 'maybe']) {
    assert.equal(isRemoteAiEnabled({ YUU_REMOTE_AI: value }), false, value);
  }
});
