'use strict';

// Pure VRAM -> recommended Whisper model mapping, split out of main.js so it
// can be unit-tested without Electron or real hardware.

function recommendWhisperModel(vramMB) {
  if (vramMB >= 10000) return { model: 'large-v3', reason: '10 GB+ VRAM - best accuracy'      };
  if (vramMB >=  5000) return { model: 'medium',   reason: '5 GB+ VRAM - good accuracy'       };
  if (vramMB >=  2000) return { model: 'small',    reason: '2 GB+ VRAM - balanced'            };
  if (vramMB >=  1000) return { model: 'base',     reason: '1 GB+ VRAM - fast'                };
  return                      { model: 'base',     reason: 'CPU mode - base model recommended' };
}

module.exports = { recommendWhisperModel };
