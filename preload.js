const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  startCompression: (file, quality) => ipcRenderer.send('start-compression', file, quality),
  onProgress: (cb)    => ipcRenderer.on('compression-progress', (e,p) => cb(p)),
  onCompleted: (cb)   => ipcRenderer.on('compression-done',     (e,o) => cb(o))
});
