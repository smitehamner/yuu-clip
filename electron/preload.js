'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Minimal bridge — only exposes what the web UI actually calls.
contextBridge.exposeInMainWorld('electronAPI', {
  runSetupWizard: () => ipcRenderer.send('app:run-setup-wizard'),
  // Electron >= 32: renderer-side File objects from a drop event no longer carry
  // a real filesystem path (contextIsolation strips it) — webUtils.getPathForFile,
  // only callable from the preload/main side, recovers it.
  getPathForFile: (file) => webUtils.getPathForFile(file),
});
