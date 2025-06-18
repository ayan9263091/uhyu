from flask import Flask, render_template, request, send_file
import os
import subprocess
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
COMPRESSED_FOLDER = 'compressed'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(COMPRESSED_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/compress', methods=['POST'])
def compress():
    video = request.files['video']
    quality = request.form['quality']
    filename = secure_filename(video.filename)
    input_path = os.path.join(UPLOAD_FOLDER, filename)
    output_path = os.path.join(COMPRESSED_FOLDER, f"compressed_{filename}")

    video.save(input_path)

    if quality == "high":
        crf = "23"
    else:
        crf = "28"

    subprocess.call([
        "ffmpeg",
        "-i", input_path,
        "-vcodec", "libx264",
        "-crf", crf,
        output_path
    ])

    return send_file(output_path, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)
