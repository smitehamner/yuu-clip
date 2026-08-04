'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('venvAPI', {
  onProgress:  (cb) => ipcRenderer.on('venv:progress', (_, msg) => cb(msg)),
  onStatus:    (cb) => ipcRenderer.on('venv:status', (_, msg) => cb(msg)),
  minimize:    () => ipcRenderer.send('venv:minimize'),
  requestClose: () => ipcRenderer.send('venv:close'),
});
