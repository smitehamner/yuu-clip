'use strict';

// Disk-space precheck for one-click model downloads (Ollama pull + .gguf fetch).
// A multi-GB download that runs out of space fails late with a cryptic error;
// checking up front lets the wizard show an actionable message instead. The
// pure helpers are unit-tested (test/disk-space.test.js); freeBytesAt does the
// one real filesystem call and is exercised end-to-end by a wizard download.

const fs = require('fs');
const path = require('path');

// Headroom beyond the model's own size - downloads write a .part file and
// (for Ollama) temporary blobs before the final rename.
const DEFAULT_HEADROOM_GB = 2;

function bytesNeeded(sizeGb, headroomGb = DEFAULT_HEADROOM_GB) {
  return Math.ceil((Number(sizeGb || 0) + headroomGb) * 1e9);
}

function hasEnoughSpace(freeBytes, neededBytes) {
  return Number(freeBytes) >= Number(neededBytes);
}

function formatGb(bytes) {
  return (Number(bytes) / 1e9).toFixed(1);
}

// Nearest existing ancestor - statfs needs a real path, and a models dir may
// not exist yet on a first run.
function existingAncestor(target) {
  let dir = path.resolve(target);
  while (!fs.existsSync(dir)) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

function freeBytesAt(target) {
  const stats = fs.statfsSync(existingAncestor(target));
  return stats.bavail * stats.bsize;
}

// Returns null when there's room (or space can't be determined - never block on
// an unknowable), or an actionable message when the drive is too full.
function diskShortfallMessage(target, sizeGb, headroomGb = DEFAULT_HEADROOM_GB) {
  const needed = bytesNeeded(sizeGb, headroomGb);
  let free;
  try { free = freeBytesAt(target); }
  catch (_) { return null; }
  if (hasEnoughSpace(free, needed)) return null;
  return `Not enough disk space: about ${formatGb(needed)} GB is needed but only `
       + `${formatGb(free)} GB is free on that drive. Free up space and try again.`;
}

module.exports = {
  DEFAULT_HEADROOM_GB,
  bytesNeeded,
  hasEnoughSpace,
  formatGb,
  existingAncestor,
  freeBytesAt,
  diskShortfallMessage,
};
