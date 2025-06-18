const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('compress-video', (event, { filePath, quality }) => {
  return new Promise((resolve, reject) => {
    const ext      = path.extname(filePath);
    const base     = path.basename(filePath, ext);
    const output   = path.join(path.dirname(filePath), `compressed_${quality}_${base}${ext}`);
    const vbr      = quality === 'high' ? '2M'   : '800k';
    const abr      = quality === 'high' ? '128k' : '96k';
    const preset   = quality === 'high' ? 'slow' : 'medium';

    const ffmpegCmd = process.platform === 'win32'
      ? path.join(__dirname, 'ffmpeg.exe')  // if you bundled ffmpeg.exe
      : 'ffmpeg';                           // if you have it in PATH
    const args = [
      '-i', filePath,
      '-c:v','libx264','-b:v',vbr,'-preset',preset,
      '-c:a','aac','-b:a',abr,
      '-progress','pipe:1','-nostats',
      output
    ];

    const proc = spawn(ffmpegCmd, args);
    let duration = 0, lastPct = 0;

    proc.stdout.on('data', data => {
      data.toString().split(/\r?\n/).forEach(line => {
        const [key,val] = line.split('=');
        if (key==='duration') duration = parseInt(val,10);
        if (key==='out_time_ms' && duration) {
          const pct = Math.min(Math.round(parseInt(val,10)/duration*100),100);
          if (pct !== lastPct) {
            lastPct = pct;
            event.sender.send('ffmpeg-progress', pct);
          }
        }
        if (key==='progress' && val==='end') {
          event.sender.send('ffmpeg-progress', 100);
        }
      });
    });

    proc.on('close', code => code===0 ? resolve(output) : reject(`FFmpeg exited ${code}`));
    proc.on('error', err => reject(err.message));
  });
});
