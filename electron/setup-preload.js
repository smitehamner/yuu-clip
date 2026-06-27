'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setupAPI', {
  getStatus:       ()        => ipcRenderer.invoke('setup:get-status'),
  pullModel:       (model)   => ipcRenderer.send('setup:pull-model', model),
  onPullProgress:  (cb)      => ipcRenderer.on('setup:pull-progress', (_, data) => cb(data)),
  openURL:         (url)     => ipcRenderer.send('setup:open-url', url),
  pickFolder:      ()        => ipcRenderer.invoke('setup:pick-folder'),
  complete:        (config)  => ipcRenderer.send('setup:complete', config),
  quit:            ()        => ipcRenderer.send('setup:quit'),
});
