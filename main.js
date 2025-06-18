const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 700,
    height: 650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.loadFile('index.html');
}

ipcMain.handle('compress-video', async (event, { inputPath, quality }) => {
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const outputPath = path.join(path.dirname(inputPath), `compressed_${quality}_${base}${ext}`);

  const videoBitrate = quality === 'high' ? '2M' : '800k';
  const audioBitrate = quality === 'high' ? '128k' : '96k';
  const preset       = quality === 'high' ? 'slow' : 'medium';

  // ffmpeg must be in your PATH or specify full path: "C:\\ffmpeg\\bin\\ffmpeg.exe"
  const cmd = `ffmpeg -i "${inputPath}" -c:v libx264 -b:v ${videoBitrate} -preset ${preset} -c:a aac -b:a ${audioBitrate} "${outputPath}"`;

  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(stderr);
      else    resolve(outputPath);
    });
  });
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
