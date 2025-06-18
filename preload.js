// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Send a message to start compression
  startCompression: (filePath, quality) => {
    ipcRenderer.send('start-compression', filePath, quality);
  },
  // Receive progress updates (value 0-100)
  onProgress: (callback) => {
    ipcRenderer.on('compression-progress', (event, percent) => callback(percent));
  },
  // Receive completion notification (with output path)
  onCompleted: (callback) => {
    ipcRenderer.on('compression-done', (event, outputPath) => callback(outputPath));
  }
});
