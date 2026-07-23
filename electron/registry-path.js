'use strict';

// Pure merge logic for refreshPathFromRegistry, split out of main.js for
// testability (execFileSync'ing the registry itself needs a real Windows box,
// but the merge is plain string logic). Merges freshly-read registry PATH
// entries onto the process's current PATH instead of replacing it outright,
// so process-local entries (an activated dev venv, directories a parent shell
// added) survive a mid-session refresh. Windows PATH lookups are
// case-insensitive, so dedupe case-insensitively too - both against the
// existing PATH and across entries that appear in both HKLM and HKCU.
function mergePathEntries(currentPath, registryPath) {
  const existing = (currentPath || '').split(';').map(s => s.trim()).filter(Boolean);
  const seenLower = new Set(existing.map(s => s.toLowerCase()));
  const merged = [...existing];
  for (const entry of (registryPath || '').split(';').map(s => s.trim()).filter(Boolean)) {
    const key = entry.toLowerCase();
    if (seenLower.has(key)) continue;
    seenLower.add(key);
    merged.push(entry);
  }
  return merged.join(';');
}

module.exports = { mergePathEntries };
