'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommendLocalModel, MODEL_ID, MODEL_SIZE_GB } = require('../recommend-model');
const { bytesNeeded } = require('../disk-space');

const NEEDED_BYTES = bytesNeeded(MODEL_SIZE_GB);
const NEEDED_GB = NEEDED_BYTES / 1e9;

test('high-end GPU with ample disk gets a strong push', () => {
  const rec = recommendLocalModel({ vramMB: 8000, freeDiskGB: 20, gpuVendor: 'nvidia' });
  assert.equal(rec.push, 'strong');
  assert.equal(rec.modelId, MODEL_ID);
  assert.equal(rec.sizeGb, MODEL_SIZE_GB);
  assert.match(rec.reason, /Capable GPU detected/);
});

test('strong push at the exact VRAM and disk boundary', () => {
  const rec = recommendLocalModel({ vramMB: 6000, freeDiskGB: 8, gpuVendor: 'nvidia' });
  assert.equal(rec.push, 'strong');
});

test('just under the VRAM boundary softens to soft', () => {
  const rec = recommendLocalModel({ vramMB: 5999, freeDiskGB: 20, gpuVendor: 'nvidia' });
  assert.equal(rec.push, 'soft');
});

test('just under the strong disk boundary softens to soft', () => {
  const rec = recommendLocalModel({ vramMB: 8000, freeDiskGB: 7.99, gpuVendor: 'nvidia' });
  assert.equal(rec.push, 'soft');
});

test('CPU-only with ample disk gets a soft push with an honest CPU note', () => {
  const rec = recommendLocalModel({ vramMB: 0, freeDiskGB: 20, gpuVendor: 'unknown' });
  assert.equal(rec.push, 'soft');
  assert.equal(rec.modelId, MODEL_ID);
  assert.match(rec.reason, /Runs on CPU, will be slower/);
});

test('weak GPU (below VRAM threshold) with ample disk gets soft, no false strong push', () => {
  const rec = recommendLocalModel({ vramMB: 2000, freeDiskGB: 20, gpuVendor: 'nvidia' });
  assert.equal(rec.push, 'soft');
});

// AMD/Intel accelerate LLM scoring via the bundled Vulkan build, but their VRAM
// can't be measured reliably (only NVIDIA gets an nvidia-smi override), so they
// stay on the lightweight recommendation - without the false "runs on CPU" claim.
test('AMD GPU softens for unmeasured VRAM, not a false CPU claim', () => {
  const rec = recommendLocalModel({ vramMB: 8000, freeDiskGB: 20, gpuVendor: 'amd' });
  assert.equal(rec.push, 'soft');
  assert.match(rec.reason, /video memory could not be measured/);
  assert.doesNotMatch(rec.reason, /Runs on CPU/);
});

test('Intel GPU softens for unmeasured VRAM, not a false CPU claim', () => {
  const rec = recommendLocalModel({ vramMB: 8000, freeDiskGB: 20, gpuVendor: 'intel' });
  assert.equal(rec.push, 'soft');
  assert.match(rec.reason, /video memory could not be measured/);
  assert.doesNotMatch(rec.reason, /Runs on CPU/);
});

test('low disk exactly at the bytesNeeded boundary is not none', () => {
  const rec = recommendLocalModel({ vramMB: 0, freeDiskGB: NEEDED_GB, gpuVendor: 'unknown' });
  assert.notEqual(rec.push, 'none');
});

test('low disk just under the bytesNeeded boundary is none', () => {
  const justUnderGb = (NEEDED_BYTES - 1) / 1e9;
  const rec = recommendLocalModel({ vramMB: 8000, freeDiskGB: justUnderGb, gpuVendor: 'nvidia' });
  assert.equal(rec.push, 'none');
  assert.equal(rec.modelId, null);
  assert.equal(rec.sizeGb, null);
  assert.match(rec.reason, /Not enough disk space/);
});

test('disk unknown (undefined) falls back to soft, never none', () => {
  const rec = recommendLocalModel({ vramMB: 8000, freeDiskGB: undefined, gpuVendor: 'nvidia' });
  assert.equal(rec.push, 'soft');
  assert.notEqual(rec.push, 'none');
});

test('disk unknown (null) falls back to soft, never none', () => {
  const rec = recommendLocalModel({ vramMB: 0, freeDiskGB: null, gpuVendor: 'unknown' });
  assert.equal(rec.push, 'soft');
});

test('every recommendation includes a headline and a reason string', () => {
  const cases = [
    { vramMB: 8000, freeDiskGB: 20, gpuVendor: 'nvidia' },
    { vramMB: 0, freeDiskGB: 20, gpuVendor: 'unknown' },
    { vramMB: 8000, freeDiskGB: 0.1, gpuVendor: 'nvidia' },
  ];
  for (const params of cases) {
    const rec = recommendLocalModel(params);
    assert.equal(typeof rec.headline, 'string');
    assert.ok(rec.headline.length > 0);
    assert.equal(typeof rec.reason, 'string');
    assert.ok(rec.reason.length > 0);
  }
});
