const fs = require("fs");
const formidable = require("formidable");
const fetch = require("node-fetch");


export const config = {
  api: {
    bodyParser: false,
  },
};


const ASSEMBLYAI_API_KEY = "8d33d7d860054823815205dab400df2d";


const ALLOWED_ORIGINS = [
  "https://supertails.vercel.app",
  "https://turbo-space-zebra-vjr594vv9xjhpq5q-5500.app.github.dev",
  "http://localhost", // Allow localhost for local dev if needed
  "http://127.0.0.1",
];


function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  // Allow all origins in development, restrict in production
  // This is a simplified check, you might want a more robust one
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const allowOrigin = isDevelopment ? '*' : (ALLOWED_ORIGINS.includes(origin) ? origin : null);

  if (allowOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  }

  // Always allow credentials if needed (adjust based on your auth flow)
  // res.setHeader("Access-Control-Allow-Credentials", "true");

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Add Authorization if you use it
}


async function uploadAudio(filePath) {
  const url = "https://api.assemblyai.com/v2/upload";
  console.log(`Uploading audio file from path: ${filePath}`);
  let fileStream;
  try {
    fileStream = fs.createReadStream(filePath);
  } catch (readErr) {
      console.error("Error creating read stream:", readErr);
      throw new Error("Failed to read uploaded file for upload.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": ASSEMBLYAI_API_KEY,
      // Content-Type is set automatically by node-fetch with stream body
    },
    body: fileStream,
  });

  const responseBodyText = await response.text();
  console.log("AssemblyAI Upload API response status:", response.status);
  // console.log("AssemblyAI Upload API response body:", responseBodyText); // Sensitive, log carefully


  if (!response.ok) {
      console.error(`AssemblyAI Upload API Error (${response.status}): ${responseBodyText}`);
      throw new Error(`Audio upload failed (status ${response.status}). Check server logs.`);
  }

  try {
    const data = JSON.parse(responseBodyText);
    if (!data.upload_url) {
        console.error("Upload response missing 'upload_url':", data);
        throw new Error("Upload succeeded but response format was unexpected.");
    }
    console.log("Uploaded file URL:", data.upload_url);
    return data.upload_url;
  } catch (parseErr) {
    console.error("Error parsing upload response JSON:", parseErr, "Body was:", responseBodyText);
    throw new Error("Upload response was not valid JSON.");
  }
}


async function requestTranscription(audioUrl, languageCode) {
  const url = "https://api.assemblyai.com/v2/transcript";
  console.log("Requesting transcription for audio URL:", audioUrl, "with language code:", languageCode);
  const payload = { audio_url: audioUrl };
  if (languageCode && languageCode !== "auto") {
    payload["language_code"] = languageCode;
  } else {
    payload["language_detection"] = true; // Explicitly enable if 'auto' or not provided
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": ASSEMBLYAI_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseBodyText = await response.text();
  console.log("AssemblyAI Transcription Request API response status:", response.status);
  // console.log("AssemblyAI Transcription Request API response body:", responseBodyText);


   if (!response.ok) {
      console.error(`AssemblyAI Transcription Request API Error (${response.status}): ${responseBodyText}`);
      throw new Error(`Transcription request failed (status ${response.status}). Check server logs.`);
  }

  try {
    const data = JSON.parse(responseBodyText);
     if (!data.id) {
        console.error("Transcription request response missing 'id':", data);
        throw new Error("Transcription request succeeded but response format was unexpected.");
    }
    console.log("Transcription job ID:", data.id);
    return data.id;
  } catch (parseErr) {
     console.error("Error parsing transcription request response JSON:", parseErr, "Body was:", responseBodyText);
     throw new Error("Transcription request response was not valid JSON.");
  }
}


async function pollTranscription(transcriptId) {
  const url = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
  const maxAttempts = 20; // Limit polling attempts (~1 minute)
  let attempt = 0;

  console.log("Polling transcription status for ID:", transcriptId);

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`Polling attempt ${attempt}/${maxAttempts} for ${transcriptId}`);

    const response = await fetch(url, {
      method: "GET",
      headers: { "authorization": ASSEMBLYAI_API_KEY },
    });

    const responseBodyText = await response.text();
    // console.log("Polling response text:", responseBodyText); // Can be verbose


     if (!response.ok) {
        console.error(`AssemblyAI Polling API Error (${response.status}): ${responseBodyText}`);
        // Decide if error is terminal or retryable (e.g. 404 might mean ID invalid)
        if (response.status === 404) throw new Error(`Transcription ID ${transcriptId} not found.`);
         throw new Error(`Polling failed (status ${response.status}). Check server logs.`);
    }


    let data;
    try {
      data = JSON.parse(responseBodyText);
    } catch (parseErr) {
        console.error("Error parsing polling response JSON:", parseErr, "Body was:", responseBodyText);
        throw new Error("Polling response was not valid JSON.");
    }

    console.log(`Transcription status for ${transcriptId}: ${data.status}`);

    if (data.status === "completed") {
      console.log("Transcription completed successfully.");
      return data.text || ""; // Return empty string if text is missing
    } else if (data.status === "error") {
      console.error("Transcription job failed:", data.error);
      throw new Error("Transcription failed: " + data.error);
    } else if (data.status === "queued" || data.status === "processing") {
      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 second delay
    } else {
        console.warn("Unknown transcription status:", data.status);
        // Optionally treat unknown status as error or continue polling
         await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // If loop finishes without completion
  console.error(`Transcription ${transcriptId} timed out after ${maxAttempts} attempts.`);
  throw new Error("Transcription timed out.");
}


export default async function handler(req, res) {
  setCorsHeaders(req, res);


  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return res.status(204).end(); // Use 204 No Content for OPTIONS
  }

  if (req.method !== "POST") {
    console.log(`Method not allowed: ${req.method}`);
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  console.log("Received POST request for transcription.");


  const form = formidable({
      multiples: false,
      keepExtensions: true,
      uploadDir: "/tmp", // Vercel allows writing to /tmp
      maxFileSize: 25 * 1024 * 1024 // Set a reasonable max size (e.g., 25MB)
  });

   let filePathToDelete = null; // Keep track of the file path for cleanup

   try {
     const { fields, files } = await new Promise((resolve, reject) => {
         form.parse(req, (err, fields, files) => {
            if (err) {
                console.error("Error parsing form data:", err);
                // Check for specific errors like file size exceeded
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return reject(new Error("File size limit exceeded."));
                }
                return reject(new Error("Error parsing form data."));
            }
            resolve({ fields, files });
         });
     });


    if (!files.file || !files.file.filepath) { // V3 formidable uses filepath
      console.error("No file provided or filepath missing in form data.");
      return res.status(400).json({ error: "No file uploaded." });
    }

    filePathToDelete = files.file.filepath; // Store path for cleanup
    const languageCode = fields.language || "auto";
    console.log("Language code received:", languageCode);
    console.log("File received, stored temporarily at:", filePathToDelete);


    const audioUrl = await uploadAudio(filePathToDelete);
    const transcriptId = await requestTranscription(audioUrl, languageCode);
    const transcriptionText = await pollTranscription(transcriptId);

    console.log("Transcription successful, returning text.");
    res.status(200).setHeader("Content-Type", "text/plain").send(transcriptionText);

  } catch (error) {
    console.error("Error during transcription process:", error);
    // Send a generic error message to the client
    res.status(500).json({ error: error.message || "An internal server error occurred during transcription." });
  } finally {
     // Cleanup the temporary file
     if (filePathToDelete) {
         fs.unlink(filePathToDelete, (unlinkErr) => {
             if (unlinkErr) {
                 console.error("Error deleting temporary file:", filePathToDelete, unlinkErr);
             } else {
                 console.log("Temporary file deleted successfully:", filePathToDelete);
             }
         });
     }
  }
}
