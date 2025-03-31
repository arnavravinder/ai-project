export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    return res.status(200).end()
  }

  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

    let bodyData
    if (typeof req.body === 'string') {
      try {
        bodyData = JSON.parse(req.body)
      } catch (e) {
        console.error("Failed to parse request body:", req.body);
        return res.status(400).json({ error: "Invalid JSON in request body" });
      }
    } else {
      bodyData = req.body
    }

    const prompt = bodyData?.prompt || "No prompt provided";

    if (!process.env.GEMINI_API_KEY) {
      console.error("Gemini API key not set in environment variables.");
      return res.status(500).json({ error: "Server configuration error: API key missing." });
    }

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    console.log("Sending request to Gemini...");

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Received response from Gemini:", response.status);

    if (!response.ok) {
        console.error("Gemini API Error Response:", data);
        const errorMsg = data?.error?.message || `API request failed with status ${response.status}`;
        return res.status(response.status).json({ error: errorMsg, details: data });
    }


    return res.status(200).json({ data });

  } catch (err) {
    console.error("Gemini function runtime error:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.toString() });
  }
}
