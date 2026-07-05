'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { looksLikeNetworkError, describeInstallFailure } = require('../install-error');

test('classifies genuine network failures from pip stderr', () => {
  assert.equal(looksLikeNetworkError('WARNING: Retrying ... after connection broken by NewConnectionError'), true);
  assert.equal(looksLikeNetworkError('socket.timeout: The read operation timed out'), true);
  assert.equal(looksLikeNetworkError('Failed to establish a new connection: [Errno 11001] getaddrinfo failed'), true);
});

test('does not misclassify build/resolution failures as network problems', () => {
  assert.equal(looksLikeNetworkError('ERROR: Could not build wheels for llama-cpp-python'), false);
  assert.equal(looksLikeNetworkError('error: Microsoft Visual C++ 14.0 or greater is required'), false);
  assert.equal(looksLikeNetworkError(''), false);
  assert.equal(looksLikeNetworkError(undefined), false);
});

test('network failures get the connection hint', () => {
  const msg = describeInstallFailure('Failed to establish a new connection: getaddrinfo failed');
  assert.match(msg, /internet connection/i);
});

test('non-network failures get an honest next step, not a bogus connection hint', () => {
  const msg = describeInstallFailure('ERROR: Microsoft Visual C++ 14.0 or greater is required');
  assert.doesNotMatch(msg, /internet connection/i);
  assert.match(msg, /Ollama|setup log/i);
});
