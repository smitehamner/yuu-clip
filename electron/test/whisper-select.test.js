'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommendWhisperModel } = require('../whisper-select');

test('recommends large-v3 at 10 GB+ VRAM', () => {
  assert.deepEqual(recommendWhisperModel(10000), { model: 'large-v3', reason: '10 GB+ VRAM - best accuracy' });
});

test('recommends medium just under the large-v3 boundary', () => {
  assert.deepEqual(recommendWhisperModel(9999), { model: 'medium', reason: '5 GB+ VRAM - good accuracy' });
});

test('recommends medium at the 5 GB boundary', () => {
  assert.deepEqual(recommendWhisperModel(5000), { model: 'medium', reason: '5 GB+ VRAM - good accuracy' });
});

test('recommends small just under the medium boundary', () => {
  assert.deepEqual(recommendWhisperModel(4999), { model: 'small', reason: '2 GB+ VRAM - balanced' });
});

test('recommends small at the 2 GB boundary', () => {
  assert.deepEqual(recommendWhisperModel(2000), { model: 'small', reason: '2 GB+ VRAM - balanced' });
});

test('recommends base just under the small boundary', () => {
  assert.deepEqual(recommendWhisperModel(1999), { model: 'base', reason: '1 GB+ VRAM - fast' });
});

test('recommends base at the 1 GB boundary', () => {
  assert.deepEqual(recommendWhisperModel(1000), { model: 'base', reason: '1 GB+ VRAM - fast' });
});

test('recommends CPU-mode base just under the 1 GB boundary', () => {
  assert.deepEqual(recommendWhisperModel(999), { model: 'base', reason: 'CPU mode - base model recommended' });
});

test('recommends CPU-mode base at 0 VRAM', () => {
  assert.deepEqual(recommendWhisperModel(0), { model: 'base', reason: 'CPU mode - base model recommended' });
});
