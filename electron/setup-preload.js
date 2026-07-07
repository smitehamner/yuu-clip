'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setupAPI', {
  getStatus:         ()       => ipcRenderer.invoke('setup:get-status'),
  pullModel:         (model)  => ipcRenderer.send('setup:pull-model', model),
  cancelPull:        ()       => ipcRenderer.send('setup:cancel-pull'),
  onPullProgress:    (cb)     => ipcRenderer.on('setup:pull-progress', (_, data) => cb(data)),
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
