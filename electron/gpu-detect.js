'use strict';

// Pure parsing for GPU detection, split out from main.js so it can be unit-tested
// without Electron or real hardware. The wrappers in main.js feed real command
// output into these; tests feed fixtures.

function vendorFromName(name) {
  const nl = (name || '').toLowerCase();
  if (nl.includes('nvidia')) return 'nvidia';
  if (nl.includes('amd') || nl.includes('radeon')) return 'amd';
  if (nl.includes('intel')) return 'intel';
  return 'unknown';
}

function parseNvidiaVramMB(smiOutput) {
  const first = (smiOutput || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
  const mb = parseInt(first, 10);
  return Number.isFinite(mb) ? mb : 0;
}

// cimJson: `Get-CimInstance Win32_VideoController | ConvertTo-Json` output — an
// array of {Name, AdapterRAM}, or a bare object when there's a single adapter.
// getNvidiaVramMB: lazily invoked only for NVIDIA cards, since AdapterRAM is a
// 32-bit WMI field capped at ~4 GB and understates cards with more VRAM.
function selectGPU(cimJson, getNvidiaVramMB) {
  const parsed = JSON.parse(cimJson);
  const gpus = Array.isArray(parsed) ? parsed : [parsed];

  // AdapterRAM is only reliable enough to rank adapters (integrated vs discrete).
  gpus.sort((a, b) => (b.AdapterRAM || 0) - (a.AdapterRAM || 0));
  const best = gpus[0];
  if (!best) return { name: 'Unknown', vramMB: 0, vendor: 'unknown' };

  const name   = best.Name || 'Unknown';
  const vendor = vendorFromName(name);

  let vramMB = Math.round((best.AdapterRAM || 0) / (1024 * 1024));
  if (vendor === 'nvidia') {
    const smiVram = getNvidiaVramMB ? getNvidiaVramMB() : 0;
    if (smiVram > 0) vramMB = smiVram;
  }

  return { name, vramMB, vendor };
}

module.exports = { vendorFromName, parseNvidiaVramMB, selectGPU };
