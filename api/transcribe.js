// api/transcribe.js

const fs = require("fs");
const formidable = require("formidable");
const fetch = require("node-fetch");

// Disable the default body parser so we can handle multipart/form-data.
export const config = {
  api: {
    bodyParser: false,
  },
};

// Whitelist allowed origins for CORS.
const ALLOWED_ORIGINS = [
  "https://supertails.vercel.app",
  "https://turbo-space-zebra-vjr594vv9xjhpq5q-5500.app.github.dev",
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// Upload the audio file to AssemblyAI.
async function uploadAudio(filePath, apiKey) {
  const url = "https://api.assemblyai.com/v2/upload";
  const fileStream = fs.createReadStream(filePath);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: apiKey,
    },
    body: fileStream,
  });
  if (!response.ok) {
    throw new Error("Failed to upload audio file: " + (await response.text()));
  }
  const data = await response.json();
  return data.upload_url;
}

// Request a transcription job from AssemblyAI.
async function requestTranscription(audioUrl, apiKey) {
  const url = "https://api.assemblyai.com/v2/transcript";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ audio_url: audioUrl }),
  });
  if (!response.ok) {
    throw new Error("Failed to request transcription: " + (await response.text()));
  }
  const data = await response.json();
  return data.id;
}

// Poll AssemblyAI until the transcription is complete.
async function pollTranscription(transcriptId, apiKey) {
  const url = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
  while (true) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        authorization: apiKey,
      },
    });
    if (!response.ok) {
      throw new Error("Error polling transcription: " + (await response.text()));
    }
    const data = await response.json();
    if (data.status === "completed") {
      return data.text;
    } else if (data.status === "error") {
      throw new Error("Transcription error: " + data.error);
    }
    // Wait 3 seconds before polling again.
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  // Handle preflight requests.
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Retrieve the AssemblyAI API key from environment variables.
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing AssemblyAI API key" });
  }

  // Use formidable to parse the incoming form data.
  const form = formidable({ multiples: false, keepExtensions: true, uploadDir: "/tmp" });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: "Error parsing the form data" });
    }
    if (!files.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    // Depending on your formidable version the uploaded file path may be in `filepath` or `path`.
    const filePath = files.file.filepath || files.file.path;

    try {
      // Upload the file to AssemblyAI.
      const audioUrl = await uploadAudio(filePath, apiKey);
      // Request the transcription job.
      const transcriptId = await requestTranscription(audioUrl, apiKey);
      // Poll until the transcription is complete.
      const transcriptionText = await pollTranscription(transcriptId, apiKey);
      // Return the transcription text as plain text.
      res.status(200).setHeader("Content-Type", "text/plain").send(transcriptionText);
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      // Remove the temporary file.
      fs.unlink(filePath, () => {});
    }
  });
}
