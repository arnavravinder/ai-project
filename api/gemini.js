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
      } catch (parseError) {
           console.error("Error parsing request body:", parseError);
           return res.status(400).json({ error: "Invalid JSON in request body" });
      }
    } else {
      bodyData = req.body
    }

    const prompt = bodyData.prompt || "No prompt provided"

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable not set.");
        return res.status(500).json({ error: "API key configuration error" });
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;
    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };


    const response = await fetch(url, fetchOptions);
    const data = await response.json();


    if (!response.ok) {
        console.error("Gemini API Error Response:", data);
        const errorMessage = data?.error?.message || `API request failed with status ${response.status}`;
        return res.status(response.status).json({ error: errorMessage });
    }


    return res.status(200).json({ data });

  } catch (err) {
    console.error("Gemini function error:", err);

    // Avoid sending detailed internal errors to the client in production
    const clientErrorMessage = err instanceof Error ? err.message : "An unexpected server error occurred.";
    return res.status(500).json({ error: clientErrorMessage });
  }
}