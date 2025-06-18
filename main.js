const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// Parse "HH:MM:SS.xx" into seconds
function parseDuration(str) {
  const [h, m, s] = str.split(':');
  return Number(h) * 3600 + Number(m) * 60 + parseFloat(s);
}

ipcMain.on('start-compression', (event, filePath, quality) => {
  const win = BrowserWindow.getFocusedWindow();
  const { dir, name, ext } = path.parse(filePath);
  const outputName = `compressed_${quality}_${name}${ext}`;
  const outputPath = path.join(dir, outputName);
  const ffmpegPath = path.join(__dirname, 'ffmpeg.exe'); // ensure this exists

  // 1) Probe duration
  let probeOutput = '';
  const probe = spawn(ffmpegPath, ['-i', filePath]);
  probe.stderr.on('data', d => probeOutput += d.toString());
  probe.on('close', () => {
    const m = probeOutput.match(/Duration: (\d+:\d+:\d+\.\d+)/);
    const durationSec = m ? parseDuration(m[1]) : 0;

    // 2) Build encode args
    const vbr    = quality === 'high' ? '2000k' : '800k';
    const abr    = quality === 'high' ? '128k'  : '96k';
    const preset = quality === 'high' ? 'slow'   : 'medium';
    const args = [
      '-y',
      '-progress', 'pipe:1',
      '-nostats',
      '-i', filePath,
      '-c:v', 'libx264',
      '-preset', preset,
      '-b:v', vbr,
      '-c:a', 'aac',
      '-b:a', abr,
      outputPath
    ];

    const ff = spawn(ffmpegPath, args);
    let buffer = '';
    ff.stdout.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      const info = {};
      for (const line of lines) {
        const [k, v] = line.split('=');
        if (k && v) info[k.trim()] = v.trim();
      }
      if (info.out_time_ms && durationSec > 0) {
        const t = Number(info.out_time_ms) / 1e6;
        const pct = Math.min(100, Math.floor((t / durationSec) * 100));
        win.webContents.send('compression-progress', pct);
      }
      if (info.progress === 'end') {
        win.webContents.send('compression-progress', 100);
      }
    });

    ff.on('close', code => {
      if (code === 0) win.webContents.send('compression-done', outputPath);
      else            win.webContents.send('compression-done', `Error code ${code}`);
    });
  });
});
