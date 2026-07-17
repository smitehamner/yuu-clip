'use strict';

// Pure VRAM -> recommended Whisper model mapping, split out of main.js so it
// can be unit-tested without Electron or real hardware.

// Thresholds sit ~1.5 GB above each model's measured peak VRAM (float16/CUDA, beam 5,
// word timestamps): large-v3 ~4.2 GB, medium ~2.8 GB, small ~1 GB, base ~0.4 GB. The
// headroom leaves room for a longer clip peaking higher, VRAM fragmentation, and the
// local LLM co-occupying VRAM. See the pre-public polish B1 hardware facts.
function recommendWhisperModel(vramMB) {
  if (vramMB >= 6000) return { model: 'large-v3', reason: '6 GB+ VRAM - best accuracy'       };
  if (vramMB >= 4000) return { model: 'medium',   reason: '4 GB+ VRAM - good accuracy'       };
  if (vramMB >= 2000) return { model: 'small',    reason: '2 GB+ VRAM - balanced'            };
  if (vramMB >= 1000) return { model: 'base',     reason: '1 GB+ VRAM - fast'                };
  return                     { model: 'base',     reason: 'CPU mode - base model recommended' };
}

module.exports = { recommendWhisperModel };
