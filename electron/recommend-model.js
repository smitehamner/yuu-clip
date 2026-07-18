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
  // Non-NVIDIA GPUs are gated for MODEL SIZING, not acceleration. The bundled
  // llama.cpp is the Vulkan build, so AMD/Intel GPUs do accelerate LLM scoring
  // (see docs/project/ROADMAP.md and the wizard's GPU step). But only NVIDIA
  // VRAM is measured reliably: gpu-detect.js overrides the ~4 GB-capped WMI
  // AdapterRAM via nvidia-smi for NVIDIA only, leaving AMD/Intel with that
  // unreliable capped value. Without a trustworthy VRAM figure we can't tell
  // whether the large model fits, so we fall back to the lightweight
  // recommendation rather than risk an OOM. (Flag: the isCpuOnly name and the
  // "Runs on CPU" reason strings below overstate this - they read as "no GPU
  // accel" when the real limit is only "VRAM unknown". Left for a follow-up.)
  const isCpuOnly = !vramMB || gpuVendor !== 'nvidia';
  const neededBytes = bytesNeeded(MODEL_SIZE_GB);

  // Never block on an unknowable disk check - fall back to soft, matching
  // disk-space.js's own "never block on an unknowable" philosophy.
  if (freeDiskGB === null || freeDiskGB === undefined) {
    let reason = 'Free disk space could not be determined, so lightweight is the safer default.';
    if (isCpuOnly) reason += ' ' + CPU_NOTE;
    return buildRecommendation('soft', reason);
  }

  const freeBytes = freeDiskGB * 1e9;
  if (!hasEnoughSpace(freeBytes, neededBytes)) {
    const reason = `Not enough disk space for the ${MODEL_SIZE_GB} GB model: needs about `
      + `${formatGb(neededBytes)} GB but only ${formatGb(freeBytes)} GB is free.`;
    return buildRecommendation('none', reason);
  }

  if (!isCpuOnly && vramMB >= STRONG_VRAM_MB && freeDiskGB >= STRONG_DISK_GB) {
    const reason = `Capable GPU detected (${vramMB} MB VRAM) with plenty of free disk space `
      + `for the ${MODEL_SIZE_GB} GB model.`;
    return buildRecommendation('strong', reason);
  }

  const reason = isCpuOnly
    ? `No CUDA-capable GPU detected. ${CPU_NOTE}`
    : `GPU has limited VRAM (${vramMB} MB) or disk space is tight; local AI will work but may run slower.`;
  return buildRecommendation('soft', reason);
}

module.exports = { recommendLocalModel, MODEL_ID, MODEL_SIZE_GB };
