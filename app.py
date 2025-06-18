from flask import Flask, render_template, request, send_file
import os
import subprocess
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
COMPRESSED_FOLDER = 'compressed'

# Create folders if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(COMPRESSED_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/compress', methods=['POST'])
def compress():
    if 'video' not in request.files:
        return "No video part", 400

    video = request.files['video']
    quality = request.form.get('quality', 'medium')
    filename = secure_filename(video.filename)

    input_path = os.path.join(UPLOAD_FOLDER, filename)
    output_path = os.path.join(COMPRESSED_FOLDER, f"compressed_{quality}_{filename}")

    video.save(input_path)

    # Choose CRF based on quality
    crf = "23" if quality == "high" else "28"

    try:
        subprocess.run([
            "ffmpeg",
            "-i", input_path,
            "-vcodec", "libx264",
            "-crf", crf,
            output_path
        ], check=True)
    except subprocess.CalledProcessError:
        return "Compression failed", 500

    return send_file(output_path, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)
