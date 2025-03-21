// api/transcribe.js

const fs = require("fs");
const formidable = require("formidable");
const fetch = require("node-fetch");

// Disable Vercel's default body parser so we can handle multipart/form-data.
export const config = {
  api: {
    bodyParser: false,
  },
};

// Hardcoded AssemblyAI API key (no env vars used)
const ASSEMBLYAI_API_KEY = "8d33d7d860054823815205dab400df2d";

// Allowed origins for CORS.
const ALLOWED_ORIGINS = [
  "https://supertails.vercel.app",
  "https://turbo-space-zebra-vjr594vv9xjhpq5q-5500.app.github.dev",
];

// Set CORS headers if the origin is allowed.
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// Upload the audio file to AssemblyAI.
async function uploadAudio(filePath) {
  const url = "https://api.assemblyai.com/v2/upload";
  console.log(`Uploading audio file from path: ${filePath}`);
  const fileStream = fs.createReadStream(filePath);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": ASSEMBLYAI_API_KEY,
    },
    body: fileStream,
  });
  const text = await response.text();
  console.log("Upload response text:", text);
  try {
    const data = JSON.parse(text);
    if (!response.ok) {
      throw new Error("Upload failed: " + (data.error || text));
    }
    console.log("Uploaded file URL:", data.upload_url);
    return data.upload_url;
  } catch (err) {
    console.error("Error parsing upload response:", err);
    throw new Error("Upload failed: " + text);
  }
}

// Request a transcription job from AssemblyAI.
async function requestTranscription(audioUrl) {
  const url = "https://api.assemblyai.com/v2/transcript";
  console.log("Requesting transcription for audio URL:", audioUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": ASSEMBLYAI_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ audio_url: audioUrl }),
  });
  const text = await response.text();
  console.log("Transcription request response text:", text);
  try {
    const data = JSON.parse(text);
    if (!response.ok) {
      throw new Error("Transcription request failed: " + (data.error || text));
    }
    console.log("Transcription job ID:", data.id);
    return data.id;
  } catch (err) {
    console.error("Error parsing transcription request response:", err);
    throw new Error("Transcription request failed: " + text);
  }
}

// Poll AssemblyAI until the transcription is complete.
async function pollTranscription(transcriptId) {
  const url = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
  console.log("Polling transcription status for ID:", transcriptId);
  while (true) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "authorization": ASSEMBLYAI_API_KEY,
      },
    });
    const text = await response.text();
    console.log("Polling response text:", text);
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("Error parsing polling response:", err);
      throw new Error("Polling failed: " + text);
    }
    if (data.status === "completed") {
      console.log("Transcription completed:", data.text);
      return data.text;
    } else if (data.status === "error") {
      throw new Error("Transcription error: " + data.error);
    }
    console.log("Transcription status:", data.status, "- waiting 3 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

// Vercel serverless function handler.
export default async function handler(req, res) {
  setCorsHeaders(req, res);

  // Handle CORS preflight requests.
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("Received POST request for transcription.");

  // Parse the multipart/form-data using formidable.
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    uploadDir: "/tmp",
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Error parsing form data:", err);
      return res.status(500).json({ error: "Error parsing form data: " + err.message });
    }
    if (!files.file) {
      console.error("No file provided in form data.");
      return res.status(400).json({ error: "No file provided" });
    }

    // For some versions of formidable, the file path is in `filepath` or `path`.
    const filePath = files.file.filepath || files.file.path;
    console.log("File received, stored at:", filePath);
    try {
      // Upload the file to AssemblyAI.
      const audioUrl = await uploadAudio(filePath);
      // Request the transcription job.
      const transcriptId = await requestTranscription(audioUrl);
      // Poll until the transcription is complete.
      const transcriptionText = await pollTranscription(transcriptId);
      console.log("Returning transcription text.");
      // Return the transcription as plain text.
      res.status(200).setHeader("Content-Type", "text/plain").send(transcriptionText);
    } catch (error) {
      console.error("Error during transcription process:", error);
      res.status(500).json({ error: error.message });
    } finally {
      // Delete the temporary file.
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error("Error deleting temporary file:", unlinkErr);
        } else {
          console.log("Temporary file deleted.");
        }
      });
    }
  });
}