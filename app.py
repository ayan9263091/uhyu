from flask import Flask, render_template, request, send_file
import os
import subprocess
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
COMPRESSED_FOLDER = 'compressed'
FFMPEG_PATH = os.path.join(os.getcwd(), 'ffmpeg', 'ffmpeg.exe')

# ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(COMPRESSED_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/compress', methods=['POST'])
def compress():
    # 1) validate
    if 'video' not in request.files:
        return 'No video file in request', 400

    vid = request.files['video']
    if vid.filename == '':
        return 'No file selected', 400

    quality = request.form.get('quality', 'medium')
    filename = secure_filename(vid.filename)

    # 2) save upload
    in_path = os.path.join(UPLOAD_FOLDER, filename)
    out_name = f"compressed_{filename}"
    out_path = os.path.join(COMPRESSED_FOLDER, out_name)
    vid.save(in_path)

    # 3) choose CRF
    crf = '23' if quality == 'high' else '28'

    # 4) run ffmpeg
    result = subprocess.run([
        FFMPEG_PATH,
        '-y',                 # overwrite if exists
        '-i', in_path,
        '-vcodec', 'libx264',
        '-crf', crf,
        out_path
    ], capture_output=True, text=True)

    if result.returncode != 0:
        return f"FFmpeg error:\n{result.stderr}", 500

    # 5) send back
    return send_file(out_path, as_attachment=True, download_name=out_name)

if __name__ == '__main__':
    app.run(debug=True)
