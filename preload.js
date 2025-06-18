const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startCompression: (file, quality) => ipcRenderer.send('start-compression', file, quality),
  onProgress: (cb)      => ipcRenderer.on('compression-progress', (e, pct) => cb(pct)),
  onCompleted: (cb)     => ipcRenderer.on('compression-done',     (e, out) => cb(out))
});
