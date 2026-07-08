'use strict';

// Parses pip's `--progress-bar raw` download lines into a bar fraction + label,
// split out of install.js's formatPipLine (which condenses the same lines into a
// human status string) because the venv setup window needs the raw fraction to
// drive a determinate progress bar, not just text. Confirmed against a live
// `pip download --no-cache-dir --progress-bar raw` run 2026-07-07: pip emits
// "Progress <bytes-received> of <bytes-total>" repeatedly per file, e.g.
// "Progress 0 of 12430966" ... "Progress 12430966 of 12430966", and the counter
// resets to 0 for every new package pip downloads in the same install.
function parsePipRawProgress(line) {
  if (typeof line !== 'string') return null;
  const match = line.trim().match(/^Progress\s+(\d+)\s+of\s+(\d+)/i);
  if (!match) return null;
  const done = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return null;
  const fraction = Math.min(1, Math.max(0, done / total));
  const label = `${Math.round(fraction * 100)}%`;
  return { fraction, label };
}

module.exports = { parsePipRawProgress };
