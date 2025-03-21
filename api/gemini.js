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
        bodyData = JSON.parse(req.body)
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
  
      const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
  
      return res.status(200).json({ data })
    } catch (err) {
      console.error("Gemini function error:", err)
      return res.status(500).json({ error: err.toString() })
    }
  }  