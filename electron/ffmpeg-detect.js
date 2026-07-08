'use strict';

const path = require('path');

// Packaged builds always use the bundled GPL FFmpeg - no "prefer system FFmpeg
// if present" logic (see docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md). Split out from
// main.js so it can be unit-tested without Electron or a real packaged build;
// existsSync is injected the same way gpu-detect.js injects its OS-command runner.
function resolveBundledFfmpegDir(isPackaged, bundledDir, existsSync) {
  if (!isPackaged) return null;
  const hasFfmpeg  = existsSync(path.join(bundledDir, 'ffmpeg.exe'));
  const hasFfprobe = existsSync(path.join(bundledDir, 'ffprobe.exe'));
  return (hasFfmpeg && hasFfprobe) ? bundledDir : null;
}

module.exports = { resolveBundledFfmpegDir };
