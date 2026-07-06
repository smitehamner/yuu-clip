'use strict';

// Electron-side config persistence, split out of main.js: the wrapper's own
// settings (project dir choice etc.) and the writer that seeds the backend's
// project config.json from the setup wizard.

const fs   = require('fs');
const path = require('path');
const { ELECTRON_CONFIG_PATH } = require('./constants');

function loadElectronConfig() {
  try {
    return JSON.parse(fs.readFileSync(ELECTRON_CONFIG_PATH, 'utf8'));
  } catch (_) {
    return {};
  }
}

function saveElectronConfig(updates) {
  const current = loadElectronConfig();
  const merged  = { ...current, ...updates };
  fs.mkdirSync(path.dirname(ELECTRON_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(ELECTRON_CONFIG_PATH, JSON.stringify(merged, null, 2));
}

// Write whisper_model into the project's .yuu-clip/config.json so the backend
// picks it up. Merges with any existing config rather than overwriting.
function writeProjectConfig(dir, config) {
  const cfgDir  = path.join(dir, '.yuu-clip');
  const cfgPath = path.join(cfgDir, 'config.json');
  fs.mkdirSync(cfgDir, { recursive: true });
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (_) {}
  fs.writeFileSync(cfgPath, JSON.stringify({ ...existing, ...config }, null, 2));
}

module.exports = { loadElectronConfig, saveElectronConfig, writeProjectConfig };
