'use strict';

// venv-preload.js runs in Electron's isolated preload context (see
// preload.test.js for why it can't be required directly under plain
// `node --test`); it exposes the loading-window bridge (venvAPI) used while
// the venv is being set up. Same source-text-assertion pattern as
// preload.test.js and restore-backup.test.js's main.js checks.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const venvPreloadSrc = fs.readFileSync(path.join(__dirname, '..', 'venv-preload.js'), 'utf8');
const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('venv-preload.js exposes venvAPI on the main world', () => {
  assert.match(venvPreloadSrc, /contextBridge\.exposeInMainWorld\('venvAPI'/);
});

test('onProgress subscribes to venv:progress, and main.js sends that channel', () => {
  assert.match(venvPreloadSrc, /onProgress:\s*\(cb\)\s*=>\s*ipcRenderer\.on\('venv:progress'/);
  assert.match(mainSrc, /webContents\.send\('venv:progress'/);
});

test('onStatus subscribes to venv:status, and main.js sends that channel', () => {
  assert.match(venvPreloadSrc, /onStatus:\s*\(cb\)\s*=>\s*ipcRenderer\.on\('venv:status'/);
  assert.match(mainSrc, /webContents\.send\('venv:status'/);
});

test('minimize sends venv:minimize, and main.js listens for it', () => {
  assert.match(venvPreloadSrc, /minimize:\s*\(\)\s*=>\s*ipcRenderer\.send\('venv:minimize'\)/);
  assert.match(mainSrc, /ipcMain\.on\('venv:minimize'/);
});
