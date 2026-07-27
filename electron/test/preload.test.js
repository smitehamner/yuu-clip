'use strict';

// preload.js is a contextBridge script that runs in Electron's isolated
// preload context (require('electron') resolves to the real module only
// inside a running Electron process), so it can't be required directly under
// plain `node --test`. Its logic is a set of thin one-line forwarders with no
// branching, so the behavior worth pinning is "each exposed method forwards
// to the IPC channel main.js actually wires" - asserted against source text,
// the same pattern restore-backup.test.js and setup-preload's tests use for
// main.js/setup-preload.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const preloadSrc = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('preload.js exposes electronAPI on the main world', () => {
  assert.match(preloadSrc, /contextBridge\.exposeInMainWorld\('electronAPI'/);
});

test('runSetupWizard sends app:run-setup-wizard, and main.js listens for it', () => {
  assert.match(preloadSrc, /runSetupWizard:\s*\(\)\s*=>\s*ipcRenderer\.send\('app:run-setup-wizard'\)/);
  assert.match(mainSrc, /ipcMain\.on\('app:run-setup-wizard'/);
});

test('projectChanged sends project:changed, and main.js listens for it', () => {
  assert.match(preloadSrc, /projectChanged:\s*\(newDir\)\s*=>\s*ipcRenderer\.send\('project:changed', newDir\)/);
  assert.match(mainSrc, /ipcMain\.on\('project:changed'/);
});

test('pickProjectFolder invokes project:pick-folder, and main.js handles it', () => {
  assert.match(preloadSrc, /pickProjectFolder:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('project:pick-folder'\)/);
  assert.match(mainSrc, /ipcMain\.handle\('project:pick-folder'/);
});

test('pickModelFile invokes model:pick-file, and main.js handles it', () => {
  assert.match(preloadSrc, /pickModelFile:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('model:pick-file'\)/);
  assert.match(mainSrc, /ipcMain\.handle\('model:pick-file'/);
});

test('mediaProtocol is a static flag, not an IPC call (browser-dev mode has no electronAPI at all)', () => {
  assert.match(preloadSrc, /mediaProtocol:\s*true/);
});

test('getPathForFile delegates to webUtils.getPathForFile', () => {
  assert.match(preloadSrc, /getPathForFile:\s*\(file\)\s*=>\s*webUtils\.getPathForFile\(file\)/);
});
