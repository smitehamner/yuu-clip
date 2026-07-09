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
  assert.match(msg, /setup log/i);
});

test('out-of-disk-space failures point at freeing space, not the network', () => {
  const msg = describeInstallFailure('OSError: [Errno 28] No space left on device');
  assert.doesNotMatch(msg, /internet connection/i);
  assert.match(msg, /space/i);
});

test('blocked/locked-file failures point at antivirus, not the network', () => {
  const msg = describeInstallFailure('ERROR: Could not install packages ... [WinError 5] Access is denied');
  assert.doesNotMatch(msg, /internet connection/i);
  assert.match(msg, /antivirus/i);
});

test('a missing wheel (GPU tag mismatch) offers the CPU fallback, not a connection hint', () => {
  const msg = describeInstallFailure('ERROR: Could not find a version that satisfies the requirement');
  assert.doesNotMatch(msg, /internet connection/i);
  assert.match(msg, /CPU/i);
});

test('a CUDA load failure reassures the user CPU still works', () => {
  const msg = describeInstallFailure('OSError: [WinError 126] cublas64_12.dll could not be found');
  assert.match(msg, /CPU/i);
});

test('a build error (MSVC/"could not build wheels") falls through to the generic step', () => {
  // Must NOT hit the missing-wheel branch (which keys on "could not find a version").
  const msg = describeInstallFailure('ERROR: Could not build wheels for llama-cpp-python');
  assert.match(msg, /setup log/i);
});
