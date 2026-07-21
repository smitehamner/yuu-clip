// Header setup-warning chip (static/core/gpustatus.js): flags something that's
// turned on but silently not working (missing CUDA libs for transcription, LLM GPU
// offload falling back to CPU, or LLM scoring enabled with no usable model) - see
// /api/status's gpu-setup and llm-setup fields.
import { gpuMismatchReasons, renderGpuWarningChip } from '../../../yuu_clip/web/static/core/gpustatus.js';

const baseStatus = {
  nvidia_gpu_present: false,
  cuda_libs_installed: false,
  whisper_device: 'auto',
  llm_use_gpu: true,
  llm_gpu_available: true,
  llm_enabled: true,
  generative_ai_allowed: true,
  llm_ready: true,
};

describe('gpuMismatchReasons', () => {
  it('no reasons when GPU is unused/unneeded and LLM scoring is ready', () => {
    expect(gpuMismatchReasons(baseStatus)).toEqual([]);
  });

  it('flags an NVIDIA GPU present but CUDA libs missing', () => {
    const reasons = gpuMismatchReasons({ ...baseStatus, nvidia_gpu_present: true });
    expect(reasons).toHaveLength(1);
    expect(reasons[0].text).toMatch(/Transcription/);
    expect(reasons[0].section).toBe('settings-sec-hardware');
  });

  it('does not flag CUDA libs missing when the user explicitly chose CPU', () => {
    const reasons = gpuMismatchReasons({
      ...baseStatus, nvidia_gpu_present: true, whisper_device: 'cpu',
    });
    expect(reasons).toEqual([]);
  });

  it('flags LLM GPU offload requested but unavailable', () => {
    const reasons = gpuMismatchReasons({ ...baseStatus, llm_gpu_available: false });
    expect(reasons).toHaveLength(1);
    expect(reasons[0].text).toMatch(/LLM scoring/);
    expect(reasons[0].section).toBe('settings-sec-hardware');
  });

  it('does not flag LLM GPU offload when the user turned it off', () => {
    const reasons = gpuMismatchReasons({
      ...baseStatus, llm_use_gpu: false, llm_gpu_available: false,
    });
    expect(reasons).toEqual([]);
  });

  it('does not flag an unknown (null) LLM GPU probe result', () => {
    const reasons = gpuMismatchReasons({ ...baseStatus, llm_gpu_available: null });
    expect(reasons).toEqual([]);
  });

  it('reports both GPU reasons at once', () => {
    const reasons = gpuMismatchReasons({
      ...baseStatus, nvidia_gpu_present: true, cuda_libs_installed: false, llm_gpu_available: false,
    });
    expect(reasons).toHaveLength(2);
  });

  it('flags LLM scoring enabled with no usable model set up', () => {
    const reasons = gpuMismatchReasons({ ...baseStatus, llm_ready: false });
    expect(reasons).toHaveLength(1);
    expect(reasons[0].text).toMatch(/LLM scoring/);
    expect(reasons[0].section).toBe('settings-sec-llm');
  });

  it('does not flag a missing model when the user turned LLM scoring off', () => {
    const reasons = gpuMismatchReasons({
      ...baseStatus, llm_enabled: false, llm_ready: false,
    });
    expect(reasons).toEqual([]);
  });

  it('does not flag a missing model when generative AI is disabled at the privacy level', () => {
    const reasons = gpuMismatchReasons({
      ...baseStatus, generative_ai_allowed: false, llm_ready: false,
    });
    expect(reasons).toEqual([]);
  });
});

describe('renderGpuWarningChip', () => {
  it('hides the chip and clears its title when there is no mismatch', () => {
    const chip = document.getElementById('gpu-warning-chip');
    chip.style.display = '';
    chip.title = 'stale';
    renderGpuWarningChip(baseStatus);
    expect(chip.style.display).toBe('none');
    expect(chip.title).toBe('');
  });

  it('shows the chip with a joined title when there is a mismatch', () => {
    const chip = document.getElementById('gpu-warning-chip');
    renderGpuWarningChip({ ...baseStatus, nvidia_gpu_present: true });
    expect(chip.style.display).toBe('');
    expect(chip.title).toMatch(/Transcription/);
    expect(chip.dataset.section).toBe('settings-sec-hardware');
  });

  it('points the click target at LLM scoring settings when that is the mismatch', () => {
    const chip = document.getElementById('gpu-warning-chip');
    renderGpuWarningChip({ ...baseStatus, llm_ready: false });
    expect(chip.dataset.section).toBe('settings-sec-llm');
  });

  it('does nothing when status is falsy (failed fetch)', () => {
    const chip = document.getElementById('gpu-warning-chip');
    chip.style.display = '';
    renderGpuWarningChip(null);
    expect(chip.style.display).toBe('');
  });
});
