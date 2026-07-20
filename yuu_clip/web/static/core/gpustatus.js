// Feature-map - GPU-setup warning chip (header, next to Analyze).
//   Flags a real GPU that isn't actually accelerating something - a silently slow
//   CPU fallback the user would otherwise only discover via the log after a long
//   run. API: /api/status (nvidia_gpu_present, cuda_libs_installed, whisper_device,
//   llm_use_gpu, llm_gpu_available). UI: partials/regions/header.html
//   #gpu-warning-chip. Tests: tests/js/core/gpustatus.test.js.

function gpuMismatchReasons(status) {
  const reasons = [];
  if (status.nvidia_gpu_present && !status.cuda_libs_installed && status.whisper_device !== 'cpu') {
    reasons.push('Transcription: an NVIDIA GPU was found, but the CUDA support libraries are not installed - this runs on CPU (slower).');
  }
  if (status.llm_use_gpu && status.llm_gpu_available === false) {
    reasons.push('LLM scoring: GPU offload is enabled, but no usable graphics card was found - this runs on CPU (slower).');
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
    return;
  }
  chip.style.display = '';
  chip.title = reasons.join('\n');
}

export { gpuMismatchReasons, renderGpuWarningChip };
