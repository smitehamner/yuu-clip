'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The wizard's shared catalog facts (recommended model, whisper models + languages,
// content presets, AI-privacy copy) are imported straight into setup.bundle.js at build
// time from the generated electron/shared/catalog-data.json (`yuu-dev shared-data`), so
// no runtime bridge is needed here - the renderer already has the data.

contextBridge.exposeInMainWorld('setupAPI', {
  getStatus:         ()       => ipcRenderer.invoke('setup:get-status'),
  installPackage:    (slug)   => ipcRenderer.send('setup:install-package', slug),
  onInstallProgress: (cb)     => ipcRenderer.on('setup:install-progress', (_, data) => cb(data)),
  downloadGgufModel: ()       => ipcRenderer.send('setup:download-gguf-model'),
  cancelGgufDownload: ()      => ipcRenderer.send('setup:cancel-gguf-download'),
  onGgufDownloadProgress: (cb) => ipcRenderer.on('setup:gguf-download-progress', (_, data) => cb(data)),
  restartApp:        ()       => ipcRenderer.send('setup:restart-app'),
  openURL:           (url)    => ipcRenderer.send('setup:open-url', url),
  copyText:          (text)   => ipcRenderer.send('setup:copy-text', text),
  pickFolder:        ()       => ipcRenderer.invoke('setup:pick-folder'),
  pickFile:          (opts)   => ipcRenderer.invoke('setup:pick-file', opts),
  restoreBackup:     (opts)   => ipcRenderer.invoke('setup:restore-backup', opts),
  complete:          (config) => ipcRenderer.send('setup:complete', config),
  quit:              ()       => ipcRenderer.send('setup:quit'),
  close:             ()       => ipcRenderer.send('setup:close'),
  skip:              ()       => ipcRenderer.send('setup:skip'),
});
