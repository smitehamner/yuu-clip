'use strict';

// Pure first-run/update decision for the whenReady startup sequence, split out
// of main.js so the branching that decides whether (and how) to show the
// setup wizard can be unit-tested without Electron.

function decideSetupMode({ firstRun, ffmpegOk, storedSchema, schemaVersion }) {
  const resolvedStoredSchema = storedSchema || 1;
  const setupOutdated = !firstRun && resolvedStoredSchema < schemaVersion;
  const show = firstRun || !ffmpegOk || setupOutdated;
  const mode = (setupOutdated && ffmpegOk && !firstRun) ? 'update' : 'initial';
  return { show, mode };
}

module.exports = { decideSetupMode };
