// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Helper: parse "HH:MM:SS.xx" into seconds
function parseDuration(timeStr) {
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 3600 +
         parseInt(parts[1]) * 60 +
         parseFloat(parts[2]);
}

ipcMain.on('start-compression', (event, filePath, quality) => {
  const win = BrowserWindow.getFocusedWindow();
  const { dir, name } = path.parse(filePath);
  const outputName = `compressed_${quality}_${name}.mp4`;
  const outputPath = path.join(dir, outputName);
  const ffmpegPath = path.join(__dirname, 'ffmpeg.exe');

  // First, get video duration by probing with ffmpeg -i
  let metadata = '';
  const probe = spawn(ffmpegPath, ['-i', filePath]);
  probe.stderr.on('data', data => { metadata += data.toString(); });
  probe.on('close', () => {
    // Extract duration "00:01:23.45" from metadata
    const durMatch = metadata.match(/Duration: (\d+:\d+:\d+\.\d+)/);
    const durationSec = durMatch ? parseDuration(durMatch[1]) : 0.0;

    // Build FFmpeg args for compression
    const videoBitrate = (quality === 'high') ? '2000k' : '800k';
    const audioBitrate = (quality === 'high') ? '128k' : '96k';
    const preset = (quality === 'high') ? 'slow' : 'medium';
    const ffmpegArgs = [
      '-y', // overwrite output
      '-i', filePath,
      '-c:v', 'libx264',
      '-preset', preset,
      '-b:v', videoBitrate,
      '-c:a', 'aac',
      '-b:a', audioBitrate,
      // Progress output to pipe
      '-progress', 'pipe:1',
      outputPath
    ];

    // Spawn FFmpeg for encoding
    const encoder = spawn(ffmpegPath, ffmpegArgs);

    // Parse FFmpeg progress output
    let ffout = '';
    encoder.stdout.on('data', data => {
      ffout += data.toString();
      const lines = ffout.split(/\r?\n/);
      // Keep last partial line in buffer
      ffout = lines.pop();
      let progressObj = {};
      lines.forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) {
          progressObj[key.trim()] = val.trim();
        }
      });
      if (progressObj.out_time_ms && durationSec > 0) {
        // out_time_ms is in microseconds; convert to seconds
        const timeSec = parseFloat(progressObj.out_time_ms) / 1000000;
        const percent = Math.min(100, Math.floor((timeSec / durationSec) * 100));
        // Send progress percentage to renderer
        event.sender.send('compression-progress', percent);
      }
      // Clear if finished
      if (progressObj.progress === 'end') {
        event.sender.send('compression-progress', 100);
      }
    });

    encoder.on('close', (code) => {
      if (code === 0) {
        // Notify renderer that we are done
        event.sender.send('compression-done', outputPath);
      } else {
        event.sender.send('compression-done', `Error (code ${code})`);
      }
    });
  });
});
