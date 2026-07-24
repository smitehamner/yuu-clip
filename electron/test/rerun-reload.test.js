'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// CONFIG-SAVE-KEYS-REDESIGN Stage 4: the rerun setup wizard writes config.json
// while the backend is live, so main.js must POST /api/config/reload after the
// write for the changes to apply without a restart. main.js can't be required
// directly (it needs the electron runtime), so assert on its source the same way
// restore-backup/startup-loading-status tests do.
const SRC = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('rerun-complete path POSTs /api/config/reload after writing config', () => {
  assert.match(SRC, /httpPost\(`http:\/\/127\.0\.0\.1:\$\{appPort\}\/api\/config\/reload`/);
});

test('the reload trigger lives in the rerun branch, not the initial-setup branch', () => {
  // The initial-setup branch shows the loading screen; the rerun branch closes
  // the window and reloads. Anchor the reload POST to the rerun (else) branch so
  // it is not accidentally moved onto first-run (where no server is live yet).
  const rerunBranch = SRC.slice(SRC.indexOf('showWizardLoadingScreen(win);'));
  assert.match(rerunBranch, /\/api\/config\/reload/);
});
