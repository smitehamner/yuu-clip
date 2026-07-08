'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { vendorFromName, parseNvidiaVramMB, selectGPU } = require('../gpu-detect');

// Get-CimInstance ... | ConvertTo-Json returns an array for multiple adapters
// and a bare object for a single one - cover both shapes.
const twoAdapters = JSON.stringify([
  { Name: 'AMD Radeon(TM) Graphics', AdapterRAM: 536870912 },
  { Name: 'NVIDIA GeForce RTX 4050 Laptop GPU', AdapterRAM: 4293918720 },
]);
const singleNvidia = JSON.stringify({ Name: 'NVIDIA GeForce RTX 4050 Laptop GPU', AdapterRAM: 4293918720 });

test('selects the discrete NVIDIA card over integrated graphics', () => {
  const gpu = selectGPU(twoAdapters, () => 6141);
  assert.equal(gpu.vendor, 'nvidia');
  assert.equal(gpu.name, 'NVIDIA GeForce RTX 4050 Laptop GPU');
});

test('uses nvidia-smi VRAM instead of the 4 GB AdapterRAM cap', () => {
  // AdapterRAM caps at 4293918720 (~4095 MB); nvidia-smi reports the true 6141 MB.
  const gpu = selectGPU(twoAdapters, () => 6141);
  assert.equal(gpu.vramMB, 6141);
});

test('falls back to AdapterRAM when nvidia-smi is unavailable', () => {
  const gpu = selectGPU(singleNvidia, () => 0);
  assert.equal(gpu.vramMB, 4095);
});

test('parses a single-adapter object, not just arrays', () => {
  const gpu = selectGPU(singleNvidia, () => 6141);
  assert.equal(gpu.vendor, 'nvidia');
  assert.equal(gpu.vramMB, 6141);
});

test('does not consult nvidia-smi for non-NVIDIA cards', () => {
  const amdOnly = JSON.stringify({ Name: 'AMD Radeon(TM) Graphics', AdapterRAM: 536870912 });
  const gpu = selectGPU(amdOnly, () => { throw new Error('nvidia-smi must not run'); });
  assert.equal(gpu.vendor, 'amd');
  assert.equal(gpu.vramMB, 512);
});

test('empty adapter list yields the Unknown fallback', () => {
  const gpu = selectGPU('[]', () => 0);
  assert.deepEqual(gpu, { name: 'Unknown', vramMB: 0, vendor: 'unknown' });
});

test('parseNvidiaVramMB reads the first CSV line', () => {
  assert.equal(parseNvidiaVramMB('6141\n'), 6141);
  assert.equal(parseNvidiaVramMB('  6141  \r\n8192\r\n'), 6141);
});

test('parseNvidiaVramMB returns 0 on empty or garbage output', () => {
  assert.equal(parseNvidiaVramMB(''), 0);
  assert.equal(parseNvidiaVramMB('N/A'), 0);
  assert.equal(parseNvidiaVramMB(undefined), 0);
});

test('vendorFromName classifies the major vendors', () => {
  assert.equal(vendorFromName('NVIDIA GeForce RTX 4050 Laptop GPU'), 'nvidia');
  assert.equal(vendorFromName('AMD Radeon(TM) Graphics'), 'amd');
  assert.equal(vendorFromName('Intel(R) UHD Graphics'), 'intel');
  assert.equal(vendorFromName('Some Unknown Adapter'), 'unknown');
  assert.equal(vendorFromName(undefined), 'unknown');
});
