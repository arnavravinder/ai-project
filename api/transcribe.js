const fs = require("fs");
const formidable = require("formidable");
const fetch = require("node-fetch");

export const config = {
  api: {
    bodyParser: false,
  },
};

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

const ALLOWED_ORIGINS = [
  "https://supertails.vercel.app",
  "https://turbo-space-zebra-vjr594vv9xjhpq5q-5500.app.github.dev",
  // Add other allowed origins if necessary, like localhost for development
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
     // Allow requests with no origin (like server-to-server or tools like curl) - adjust if needed
     res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function uploadAudio(filePath) {
  if (!ASSEMBLYAI_API_KEY) throw new Error("AssemblyAI API Key not configured on server.");
  const url = "https://api.assemblyai.com/v2/upload";
  console.log(`Uploading audio file from path: ${filePath}`);
  const fileStream = fs.createReadStream(filePath);
  const response = await fetch(url, {
    method: "POST",
    headers: { "authorization": ASSEMBLYAI_API_KEY },
    body: fileStream,
  });
  const text = await response.text();
  console.log("Upload response status:", response.status);
  try {
    const data = JSON.parse(text);
    if (!response.ok) throw new Error(`Upload failed: ${data?.error || text}`);
    console.log("Uploaded file URL:", data.upload_url);
    return data.upload_url;
  } catch (err) {
    console.error("Error parsing upload response:", err);
    throw new Error(`Upload parsing failed: ${text}`);
  }
}

async function requestTranscription(audioUrl, languageCode) {
    if (!ASSEMBLYAI_API_KEY) throw new Error("AssemblyAI API Key not configured on server.");
    const url = "https://api.assemblyai.com/v2/transcript";
    console.log(`Requesting transcription for URL: ${audioUrl}, Language: ${languageCode}`);
    const payload = { audio_url: audioUrl };
    if (languageCode && languageCode !== "auto") {
        payload.language_code = languageCode;
    } else {
        payload.language_detection = true; // Enable auto-detection if 'auto' or unspecified
    }

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "authorization": ASSEMBLYAI_API_KEY,
            "content-type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    const text = await response.text();
    console.log("Transcription request status:", response.status);
    try {
        const data = JSON.parse(text);
        if (!response.ok) throw new Error(`Transcription request failed: ${data?.error || text}`);
        console.log("Transcription job ID:", data.id);
        return data.id;
    } catch (err) {
        console.error("Error parsing transcription request response:", err);
        throw new Error(`Transcription request parsing failed: ${text}`);
    }
}


async function pollTranscription(transcriptId) {
    if (!ASSEMBLYAI_API_KEY) throw new Error("AssemblyAI API Key not configured on server.");
    const url = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
    console.log(`Polling transcription status for ID: ${transcriptId}`);
    const maxAttempts = 20; // Limit polling attempts
    let attempts = 0;

    while (attempts < maxAttempts) {
        attempts++;
        const response = await fetch(url, {
            method: "GET",
            headers: { "authorization": ASSEMBLYAI_API_KEY },
        });
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); }
        catch (err) {
            console.error("Error parsing polling response:", err);
            throw new Error(`Polling parsing failed: ${text}`);
        }

        console.log(`Polling attempt ${attempts}, Status: ${data.status}`);

        if (data.status === "completed") {
            console.log("Transcription completed.");
            return data.text;
        } else if (data.status === "error") {
            console.error("Transcription failed with error:", data.error);
            throw new Error(`Transcription error: ${data.error}`);
        } else if (data.status === 'queued' || data.status === 'processing') {
            // Wait before polling again
            await new Promise((resolve) => setTimeout(resolve, 3000 * attempts)); // Exponential backoff basic
        } else {
             console.warn("Unknown transcription status:", data.status);
             await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
    throw new Error(`Transcription polling timed out after ${maxAttempts} attempts.`);
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

   if (!ASSEMBLYAI_API_KEY) {
        console.error("AssemblyAI API Key is not configured on the server.");
        return res.status(500).json({ error: "Server configuration error." });
   }

  console.log("Received POST request for transcription.");
  const form = formidable({ multiples: false, keepExtensions: true, uploadDir: "/tmp" });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Error parsing form data:", err);
      return res.status(500).json({ error: `Error parsing form data: ${err.message}` });
    }

    const file = files.file?.[0] ?? files.file; // Handle formidable v3 array structure
     if (!file) {
      console.error("No file provided in form data.");
      return res.status(400).json({ error: "No file provided" });
    }

    const languageCode = fields.language?.[0] ?? fields.language ?? "auto"; // Handle formidable v3 array structure
    console.log("Language code received:", languageCode);

    const filePath = file.filepath;
    console.log("File received, stored at:", filePath);

    try {
      const audioUrl = await uploadAudio(filePath);
      const transcriptId = await requestTranscription(audioUrl, languageCode);
      const transcriptionText = await pollTranscription(transcriptId);
      console.log("Returning transcription text.");
      res.status(200).setHeader("Content-Type", "text/plain").send(transcriptionText);
    } catch (error) {
      console.error("Error during transcription process:", error);
      res.status(500).json({ error: error.message });
    } finally {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting temporary file:", unlinkErr);
        else console.log("Temporary file deleted:", filePath);
      });
    }
  });
}
