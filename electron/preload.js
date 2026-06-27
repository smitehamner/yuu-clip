'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Minimal bridge — only exposes what the web UI actually calls.
contextBridge.exposeInMainWorld('electronAPI', {
  runSetupWizard: () => ipcRenderer.send('app:run-setup-wizard'),
});
