// Feature-map - Setup-mismatch warnings: the header chip plus a matching inline
//   warning inside the specific settings row each reason is about.
//   Flags something that's turned on but silently not working - a real GPU that
//   isn't actually accelerating anything, or LLM scoring left enabled with no
//   usable model - the kind of thing a user would otherwise only discover via the
//   log after a long run. API: /api/status (nvidia_gpu_present, cuda_libs_installed,
//   whisper_device, llm_use_gpu, llm_gpu_available, llm_enabled,
//   generative_ai_allowed, llm_ready). UI: partials/regions/header.html
//   #gpu-warning-chip (hover for the full text); partials/regions/settings-panel.html
//   #settings-warn-cuda-libs / #settings-warn-llm-gpu / #settings-warn-llm-ready
//   (same text, shown as plain text next to the setting it's about - no hover
//   needed). Tests: tests/js/core/gpustatus.test.js.

function gpuMismatchReasons(status) {
  const reasons = [];
  if (status.nvidia_gpu_present && !status.cuda_libs_installed && status.whisper_device !== 'cpu') {
    reasons.push({
      text: 'Transcription: an NVIDIA GPU was found, but the CUDA support libraries are not installed - this runs on CPU (slower).',
      section: 'settings-sec-hardware',
      anchor: 'settings-warn-cuda-libs',
    });
  }
  if (status.llm_use_gpu && status.llm_gpu_available === false) {
    reasons.push({
      text: 'LLM scoring: GPU offload is enabled, but no usable graphics card was found - this runs on CPU (slower).',
      section: 'settings-sec-hardware',
      anchor: 'settings-warn-llm-gpu',
    });
  }
  if (status.llm_enabled && status.generative_ai_allowed && status.llm_ready === false) {
    reasons.push({
      text: 'LLM scoring: enabled, but no usable local model is set up - clips will score without LLM sub-scores or descriptions. Add one under Settings -> LLM scoring.',
      section: 'settings-sec-llm',
      anchor: 'settings-warn-llm-ready',
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

// Every anchor id a reason can target - listed up front so a reason that stops
// applying (mismatch resolved) still gets its inline warning hidden again.
const SECTION_WARNING_ANCHORS = ['settings-warn-cuda-libs', 'settings-warn-llm-gpu', 'settings-warn-llm-ready'];

function renderSectionWarnings(status) {
  if (!status) return;  // keep the last known warning state on a transient fetch failure
  const reasonByAnchor = new Map(
    gpuMismatchReasons(status)
      .filter(r => r.anchor)
      .map(r => [r.anchor, r.text]),
  );
  for (const anchorId of SECTION_WARNING_ANCHORS) {
    const el = document.getElementById(anchorId);
    if (!el) continue;
    const text = reasonByAnchor.get(anchorId);
    if (text) {
      el.querySelector('.settings-inline-warning-text').textContent = text;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }
}

export { gpuMismatchReasons, renderGpuWarningChip, renderSectionWarnings };
