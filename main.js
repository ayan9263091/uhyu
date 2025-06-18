const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 800, height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true  // allow require('electron').remote
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

function parseDuration(str) {
  const [h,m,s] = str.split(':');
  return Number(h)*3600 + Number(m)*60 + parseFloat(s);
}

ipcMain.on('start-compression', (event, filePath, quality) => {
  const win = BrowserWindow.getFocusedWindow();
  const { dir, name, ext } = path.parse(filePath);
  const output = path.join(dir, `compressed_${quality}_${name}${ext}`);
  const ff = path.join(__dirname, 'ffmpeg.exe');

  // 1) Probe duration
  let probe = '', durationSec = 0;
  const p = spawn(ff, ['-i', filePath]);
  p.stderr.on('data', d => probe += d.toString());
  p.on('close', () => {
    const m = probe.match(/Duration: (\d+:\d+:\d+\.\d+)/);
    if (m) durationSec = parseDuration(m[1]);

    // 2) Start encoding with progress
    const vbr    = quality==='high' ? '2000k' : '800k';
    const abr    = quality==='high' ? '128k'  : '96k';
    const preset = quality==='high' ? 'slow'   : 'medium';
    const args = [
      '-y','-progress','pipe:1','-nostats',
      '-i', filePath,
      '-c:v','libx264','-preset',preset,'-b:v',vbr,
      '-c:a','aac','-b:a',abr,
      output
    ];
    const enc = spawn(ff, args);
    let buf = '';
    enc.stdout.on('data', d => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      const info = {};
      lines.forEach(line => {
        const [k,v] = line.split('=');
        if (k && v) info[k.trim()] = v.trim();
      });
      if (info.out_time_ms && durationSec) {
        const t = Number(info.out_time_ms)/1e6;
        const pct = Math.min(100, Math.floor((t/durationSec)*100));
        win.webContents.send('compression-progress', pct);
      }
      if (info.progress==='end') {
        win.webContents.send('compression-progress', 100);
      }
    });
    enc.on('close', code => {
      win.webContents.send('compression-done',
        code===0 ? output : `Error code ${code}`);
    });
  });
});
