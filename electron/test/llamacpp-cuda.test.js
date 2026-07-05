'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  pickCudaWheelTag, buildCudaWheelUrl, buildCpuWheelUrl, selectLlamaWheelUrl,
  LLAMA_CPP_CUDA_VERSION,
} = require('../llamacpp-cuda');

const TAGS = ['cu118', 'cu121', 'cu122', 'cu123', 'cu124', 'cu125', 'cu130', 'cu132'];

test('exact match returns the same tag', () => {
  assert.equal(pickCudaWheelTag('12.4', TAGS), 'cu124');
});

test('version between two published tags picks the highest one at or below it', () => {
  assert.equal(pickCudaWheelTag('12.6', TAGS), 'cu125');
});

test('version above every published tag picks the highest available tag', () => {
  assert.equal(pickCudaWheelTag('13.9', TAGS), 'cu132');
});

test('version below the minimum published tag returns null (no compatible wheel)', () => {
  assert.equal(pickCudaWheelTag('11.4', TAGS), null);
});

test('the minimum published tag itself is a valid match', () => {
  assert.equal(pickCudaWheelTag('11.8', TAGS), 'cu118');
});

test('missing or unparseable CUDA version returns null', () => {
  assert.equal(pickCudaWheelTag(null, TAGS), null);
  assert.equal(pickCudaWheelTag(undefined, TAGS), null);
  assert.equal(pickCudaWheelTag('unknown', TAGS), null);
  assert.equal(pickCudaWheelTag('', TAGS), null);
});

test('buildCudaWheelUrl produces the expected GitHub release asset URL', () => {
  assert.equal(
    buildCudaWheelUrl('0.3.32', 'cu124'),
    'https://github.com/abetlen/llama-cpp-python/releases/download/v0.3.32-cu124/llama_cpp_python-0.3.32-py3-none-win_amd64.whl'
  );
});

test('buildCpuWheelUrl points at the plain (no -cu) release tag', () => {
  assert.equal(
    buildCpuWheelUrl('0.3.32'),
    'https://github.com/abetlen/llama-cpp-python/releases/download/v0.3.32/llama_cpp_python-0.3.32-py3-none-win_amd64.whl'
  );
});

// selectLlamaWheelUrl must always return a prebuilt win_amd64 URL — never fall
// through to a source build — across every machine shape.
test('known CUDA version → the matching CUDA wheel', () => {
  const url = selectLlamaWheelUrl({ cudaVersion: '12.4', gpuVendor: 'nvidia' });
  assert.equal(url, buildCudaWheelUrl(LLAMA_CPP_CUDA_VERSION, 'cu124'));
});

test('NVIDIA GPU but unparseable CUDA version → the lowest pinned CUDA wheel', () => {
  const url = selectLlamaWheelUrl({ cudaVersion: 'unknown', gpuVendor: 'nvidia' });
  assert.equal(url, buildCudaWheelUrl(LLAMA_CPP_CUDA_VERSION, 'cu118'));
});

test('non-NVIDIA GPU → the CPU wheel', () => {
  const url = selectLlamaWheelUrl({ cudaVersion: null, gpuVendor: 'amd' });
  assert.equal(url, buildCpuWheelUrl(LLAMA_CPP_CUDA_VERSION));
});

test('no GPU info at all → the CPU wheel', () => {
  assert.equal(selectLlamaWheelUrl({}), buildCpuWheelUrl(LLAMA_CPP_CUDA_VERSION));
  assert.equal(selectLlamaWheelUrl(), buildCpuWheelUrl(LLAMA_CPP_CUDA_VERSION));
});
