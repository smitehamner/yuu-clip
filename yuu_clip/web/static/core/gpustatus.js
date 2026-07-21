// Feature-map - Setup-mismatch warning chip (header, next to Analyze).
//   Flags something that's turned on but silently not working - a real GPU that
//   isn't actually accelerating anything, or LLM scoring left enabled with no
//   usable model - the kind of thing a user would otherwise only discover via the
//   log after a long run. API: /api/status (nvidia_gpu_present, cuda_libs_installed,
//   whisper_device, llm_use_gpu, llm_gpu_available, llm_enabled,
//   generative_ai_allowed, llm_ready). UI: partials/regions/header.html
//   #gpu-warning-chip. Tests: tests/js/core/gpustatus.test.js.

function gpuMismatchReasons(status) {
  const reasons = [];
  if (status.nvidia_gpu_present && !status.cuda_libs_installed && status.whisper_device !== 'cpu') {
    reasons.push({
      text: 'Transcription: an NVIDIA GPU was found, but the CUDA support libraries are not installed - this runs on CPU (slower).',
      section: 'settings-sec-hardware',
    });
  }
  if (status.llm_use_gpu && status.llm_gpu_available === false) {
    reasons.push({
      text: 'LLM scoring: GPU offload is enabled, but no usable graphics card was found - this runs on CPU (slower).',
      section: 'settings-sec-hardware',
    });
  }
  if (status.llm_enabled && status.generative_ai_allowed && status.llm_ready === false) {
    reasons.push({
      text: 'LLM scoring: enabled, but no usable local model is set up - clips will score without LLM sub-scores or descriptions. Add one under Settings -> LLM scoring.',
      section: 'settings-sec-llm',
    });
  }
  return reasons;
}

function renderGpuWarningChip(status) {
  const chip = document.getElementById('gpu-warning-chip');
  if (!chip || !status) return;
  const reasons = gpuMismatchReasons(status);
  if (reasons.length === 0) {
    chip.style.display = 'none';
    chip.title = '';
    chip.dataset.section = '';
    return;
  }
  chip.style.display = '';
  chip.title = reasons.map(r => r.text).join('\n');
  chip.dataset.section = reasons[0].section;
}

export { gpuMismatchReasons, renderGpuWarningChip };
