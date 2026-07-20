// Header GPU-warning chip (static/core/gpustatus.js): flags a real GPU that isn't
// actually accelerating something (missing CUDA libs for transcription, or LLM GPU
// offload silently falling back to CPU) - see /api/status's gpu-setup fields.
import { gpuMismatchReasons, renderGpuWarningChip } from '../../../yuu_clip/web/static/core/gpustatus.js';

const baseStatus = {
  nvidia_gpu_present: false,
  cuda_libs_installed: false,
  whisper_device: 'auto',
  llm_use_gpu: true,
  llm_gpu_available: true,
};

describe('gpuMismatchReasons', () => {
  it('no reasons when there is no NVIDIA GPU and LLM GPU offload is working', () => {
    expect(gpuMismatchReasons(baseStatus)).toEqual([]);
  });

  it('flags an NVIDIA GPU present but CUDA libs missing', () => {
    const reasons = gpuMismatchReasons({ ...baseStatus, nvidia_gpu_present: true });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/Transcription/);
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
    expect(reasons[0]).toMatch(/LLM scoring/);
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

  it('reports both reasons at once', () => {
    const reasons = gpuMismatchReasons({
      ...baseStatus, nvidia_gpu_present: true, cuda_libs_installed: false, llm_gpu_available: false,
    });
    expect(reasons).toHaveLength(2);
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
  });

  it('does nothing when status is falsy (failed fetch)', () => {
    const chip = document.getElementById('gpu-warning-chip');
    chip.style.display = '';
    renderGpuWarningChip(null);
    expect(chip.style.display).toBe('');
  });
});
