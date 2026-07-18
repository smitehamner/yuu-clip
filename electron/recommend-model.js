'use strict';

// Pure hardware -> local-LLM push-strength mapping, split out of main.js so it
// can be unit-tested without Electron or real hardware. Mirrors the shape of
// whisper-select.js (recommendWhisperModel).
//
// The pushed model is yuu_clip/model_catalog.py's recommended local text default,
// read from the generated shared catalog (`yuu-dev shared-data`) rather than a
// hand-copied literal - so a catalog change flows here automatically.

const { bytesNeeded, hasEnoughSpace, formatGb } = require('./disk-space');
const catalog = require('./shared/catalog-data.json');

const MODEL_ID = catalog.recommended_model.id;
const MODEL_SIZE_GB = catalog.recommended_model.size_gb;

const STRONG_VRAM_MB = 6000;
const STRONG_DISK_GB = 8;

const CPU_NOTE = 'Runs on CPU, will be slower, but still usable.';
const UNSIZED_GPU_NOTE = 'Your GPU accelerates local AI, but its video memory could not '
  + 'be measured, so lightweight is the safer pick.';

const HEADLINES = {
  strong: 'Set up local AI - this PC can run it well',
  soft: 'Local AI is available, but may run slower on this PC',
  none: 'Lightweight mode is the best fit for this PC',
};

function buildRecommendation(push, reason) {
  if (push === 'none') {
    return { push, modelId: null, sizeGb: null, headline: HEADLINES[push], reason };
  }
  return { push, modelId: MODEL_ID, sizeGb: MODEL_SIZE_GB, headline: HEADLINES[push], reason };
}

function recommendLocalModel({ vramMB, freeDiskGB, gpuVendor } = {}) {
  // Only NVIDIA VRAM is measured reliably: gpu-detect.js overrides the ~4 GB-capped
  // WMI AdapterRAM via nvidia-smi for NVIDIA only. The bundled llama.cpp is the
  // Vulkan build, so AMD/Intel GPUs still accelerate LLM scoring (see
  // docs/project/ROADMAP.md and the wizard's GPU step) - we just can't size the
  // large model for them without a trustworthy VRAM figure, so they (and machines
  // with no detectable GPU) fall back to the lightweight recommendation.
  const canSizeGpu = Boolean(vramMB) && gpuVendor === 'nvidia';
  const gpuAccelerates = gpuVendor === 'nvidia' || gpuVendor === 'amd' || gpuVendor === 'intel';
  const constraintNote = gpuAccelerates ? UNSIZED_GPU_NOTE : CPU_NOTE;
  const neededBytes = bytesNeeded(MODEL_SIZE_GB);

  // Never block on an unknowable disk check - fall back to soft, matching
  // disk-space.js's own "never block on an unknowable" philosophy.
  if (freeDiskGB === null || freeDiskGB === undefined) {
    let reason = 'Free disk space could not be determined, so lightweight is the safer default.';
    if (!canSizeGpu) reason += ' ' + constraintNote;
    return buildRecommendation('soft', reason);
  }

  const freeBytes = freeDiskGB * 1e9;
  if (!hasEnoughSpace(freeBytes, neededBytes)) {
    const reason = `Not enough disk space for the ${MODEL_SIZE_GB} GB model: needs about `
      + `${formatGb(neededBytes)} GB but only ${formatGb(freeBytes)} GB is free.`;
    return buildRecommendation('none', reason);
  }

  if (canSizeGpu && vramMB >= STRONG_VRAM_MB && freeDiskGB >= STRONG_DISK_GB) {
    const reason = `Capable GPU detected (${vramMB} MB VRAM) with plenty of free disk space `
      + `for the ${MODEL_SIZE_GB} GB model.`;
    return buildRecommendation('strong', reason);
  }

  const reason = !canSizeGpu
    ? constraintNote
    : `GPU has limited VRAM (${vramMB} MB) or disk space is tight; local AI will work but may run slower.`;
  return buildRecommendation('soft', reason);
}

module.exports = { recommendLocalModel, MODEL_ID, MODEL_SIZE_GB };
