import os
import time
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# Get the AssemblyAI API key from an environment variable
ASSEMBLYAI_API_KEY = os.environ.get("ASSEMBLYAI_API_KEY")
if not ASSEMBLYAI_API_KEY:
    raise ValueError("Missing AssemblyAI API key. Please set the ASSEMBLYAI_API_KEY environment variable.")

# AssemblyAI endpoints
UPLOAD_URL = "https://api.assemblyai.com/v2/upload"
TRANSCRIPT_URL = "https://api.assemblyai.com/v2/transcript"

# Common headers for AssemblyAI requests
headers = {
    "authorization": ASSEMBLYAI_API_KEY,
    "content-type": "application/json"
}

def upload_audio(file_path):
    """Uploads the audio file to AssemblyAI and returns the URL of the uploaded file."""
    with open(file_path, 'rb') as f:
        response = requests.post(
            UPLOAD_URL,
            headers={"authorization": ASSEMBLYAI_API_KEY},
            data=f
        )
    if response.status_code != 200:
        raise Exception("Failed to upload audio file: " + response.text)
    return response.json()["upload_url"]

def request_transcription(audio_url):
    """Sends a transcription request for the given audio URL and returns the transcript ID."""
    json_data = {"audio_url": audio_url}
    response = requests.post(TRANSCRIPT_URL, json=json_data, headers=headers)
    if response.status_code != 200:
        raise Exception("Failed to request transcription: " + response.text)
    return response.json()["id"]

def poll_transcription(transcript_id):
    """Polls AssemblyAI until the transcription is complete and returns the transcribed text."""
    polling_url = f"{TRANSCRIPT_URL}/{transcript_id}"
    while True:
        response = requests.get(polling_url, headers=headers)
        if response.status_code != 200:
            raise Exception("Error polling transcription status: " + response.text)
        status = response.json()["status"]
        if status == "completed":
            return response.json()["text"]
        elif status == "error":
            raise Exception("Transcription error: " + response.json()["error"])
        time.sleep(3)

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Expects a file upload under the key 'file'. Returns the transcription text.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    # Save the uploaded file temporarily
    temp_filename = "temp_audio"
    file.save(temp_filename)

    try:
        # Upload the file to AssemblyAI
        audio_url = upload_audio(temp_filename)
        # Request transcription
        transcript_id = request_transcription(audio_url)
        # Poll until transcription is completed
        transcription_text = poll_transcription(transcript_id)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up the temporary file
        os.remove(temp_filename)

    # Return the transcription as plain text
    return transcription_text, 200, {'Content-Type': 'text/plain'}

# WSGI entry point for Vercel.
def handler(environ, start_response):
    return app(environ, start_response)

if __name__ == '__main__':
    app.run(debug=True)
