// api/transcribe.js

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
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
     res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function uploadAudio(filePath) {
  if (!ASSEMBLYAI_API_KEY) throw new Error("AssemblyAI API Key not configured on server.");
  const url = "https://api.assemblyai.com/v2/upload";
  console.log(`[API] Uploading audio file from path: ${filePath}`); // Added API prefix to logs
  const fileStream = fs.createReadStream(filePath);
  const response = await fetch(url, {
    method: "POST",
    headers: { "authorization": ASSEMBLYAI_API_KEY },
    body: fileStream,
  });
  const text = await response.text();
  console.log("[API] Upload response status:", response.status);
  try {
    const data = JSON.parse(text);
    if (!response.ok) throw new Error(`Upload failed: ${data?.error || text}`);
    console.log("[API] Uploaded file URL:", data.upload_url);
    return data.upload_url;
  } catch (err) {
    console.error("[API] Error parsing upload response:", err);
    throw new Error(`Upload parsing failed: ${text}`);
  }
}

async function requestTranscription(audioUrl, languageCode) {
    if (!ASSEMBLYAI_API_KEY) throw new Error("AssemblyAI API Key not configured on server.");
    const url = "https://api.assemblyai.com/v2/transcript";
    // --- FIX: Ensure languageCode is valid BEFORE sending ---
    const validLanguageCode = (typeof languageCode === 'string' && languageCode.trim()) ? languageCode.trim() : 'auto';
    console.log(`[API] Requesting transcription for URL: ${audioUrl}, Language Used: ${validLanguageCode}`);
    // --- END FIX ---
    const payload = { audio_url: audioUrl };
    if (validLanguageCode && validLanguageCode !== "auto") {
        payload.language_code = validLanguageCode;
    } else {
        payload.language_detection = true;
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
    console.log("[API] Transcription request status:", response.status);
    try {
        const data = JSON.parse(text);
        if (!response.ok) throw new Error(`Transcription request failed: ${data?.error || text}`);
        console.log("[API] Transcription job ID:", data.id);
        return data.id;
    } catch (err) {
        console.error("[API] Error parsing transcription request response:", err);
        throw new Error(`Transcription request parsing failed: ${text}`);
    }
}


async function pollTranscription(transcriptId) {
    if (!ASSEMBLYAI_API_KEY) throw new Error("AssemblyAI API Key not configured on server.");
    const url = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
    console.log(`[API] Polling transcription status for ID: ${transcriptId}`);
    const maxAttempts = 20;
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
            console.error("[API] Error parsing polling response:", err);
            throw new Error(`Polling parsing failed: ${text}`);
        }

        console.log(`[API] Polling attempt ${attempts}, Status: ${data.status}`);

        if (data.status === "completed") {
            console.log("[API] Transcription completed.");
            return data.text;
        } else if (data.status === "error") {
            console.error("[API] Transcription failed with error:", data.error);
            throw new Error(`Transcription error: ${data.error}`);
        } else if (data.status === 'queued' || data.status === 'processing') {
            await new Promise((resolve) => setTimeout(resolve, 3000 * attempts));
        } else {
             console.warn("[API] Unknown transcription status:", data.status);
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
        console.error("[API] AssemblyAI API Key is not configured on the server.");
        return res.status(500).json({ error: "Server configuration error." });
   }

  console.log("[API] Received POST request for transcription.");
  const form = formidable({ multiples: false, keepExtensions: true, uploadDir: "/tmp" });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("[API] Error parsing form data:", err);
      return res.status(500).json({ error: `Error parsing form data: ${err.message}` });
    }

    // --- FIX: Robust field and file handling ---
    const fileArray = files.file; // formidable v3 often returns arrays
    const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

     if (!file) {
      console.error("[API] No file provided in form data.");
      return res.status(400).json({ error: "No file provided" });
    }

    const languageField = fields.language; // formidable v3 often returns arrays
    // Handle case where field might be an array or a string
    let languageCodeRaw = Array.isArray(languageField) ? languageField[0] : languageField;
    let languageCode = (typeof languageCodeRaw === 'string' && languageCodeRaw.trim()) ? languageCodeRaw.trim() : 'auto';

    console.log("[API] Raw language field parsed:", languageField);
    console.log("[API] Final language code determined:", languageCode);
    // --- END FIX ---

    const filePath = file.filepath;
    console.log("[API] File received, stored at:", filePath);

    try {
      const audioUrl = await uploadAudio(filePath);
      const transcriptId = await requestTranscription(audioUrl, languageCode); // Pass the cleaned languageCode
      const transcriptionText = await pollTranscription(transcriptId);
      console.log("[API] Returning transcription text.");
      res.status(200).setHeader("Content-Type", "text/plain").send(transcriptionText);
    } catch (error) {
      console.error("[API] Error during transcription process:", error);
      // Send back the specific error message from the catch block
      res.status(500).json({ error: error.message });
    } finally {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error("[API] Error deleting temporary file:", unlinkErr);
        else console.log("[API] Temporary file deleted:", filePath);
      });
    }
  });
}