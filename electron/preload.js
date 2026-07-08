'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Minimal bridge - only exposes what the web UI actually calls.
contextBridge.exposeInMainWorld('electronAPI', {
  runSetupWizard: () => ipcRenderer.send('app:run-setup-wizard'),
  // Electron >= 32: renderer-side File objects from a drop event no longer carry
  // a real filesystem path (contextIsolation strips it) - webUtils.getPathForFile,
  // only callable from the preload/main side, recovers it.
  getPathForFile: (file) => webUtils.getPathForFile(file),
  // Tells the renderer's media-URL builder (utils.js:_buildMediaUrl) that the
  // "yuu-media://" native scheme is registered in main.js - plain browser-dev
  // mode has no electronAPI at all, so it never sees this flag.
  mediaProtocol: true,
  // Project switcher (roadmap plan 03): the server swaps projects in place, but
  // main.js still serves media proxies from its own in-memory projectDir and
  // persists the choice for next launch - so the renderer tells it after a switch.
  projectChanged: (newDir) => ipcRenderer.send('project:changed', newDir),
  // Native folder picker for "Open another project…" (browser mode falls back to
  // a text input); the setup wizard already uses this same dialog pattern.
  pickProjectFolder: () => ipcRenderer.invoke('project:pick-folder'),
  // Native .gguf file picker for the Settings model-path fields (browser mode
  // falls back to the text box). Returns the chosen path, or null if cancelled.
  pickModelFile: () => ipcRenderer.invoke('model:pick-file'),
});
