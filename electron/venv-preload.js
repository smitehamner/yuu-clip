'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('venvAPI', {
  onProgress: (cb) => ipcRenderer.on('venv:progress', (_, msg) => cb(msg)),
  onStatus:   (cb) => ipcRenderer.on('venv:status', (_, text) => cb(text)),
});
