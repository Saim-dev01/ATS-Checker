
// --- Required modules ---
const express = require("express");
const cors = require("cors");
const formidable = require("formidable");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const axios = require("axios");
const FormData = require("form-data");

// --- App initialization ---
const app = express();
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true
}));

// Test endpoint to verify proxy from React
app.get('/api/test', (req, res) => {
  res.json({ message: 'Proxy to Node.js backend is working!' });
});

// --- Proxy endpoint to forward resume file to Python Flask backend ---
app.post("/api/check-resume", (req, res) => {
  const form = new formidable.IncomingForm({ keepExtensions: true, multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "File upload error: " + err.message });
    let file = files.resume || Object.values(files)[0];
    if (Array.isArray(file)) file = file[0];
    if (!file || !file.filepath) {
      return res.status(400).json({ error: "No file uploaded or file is invalid." });
    }
    try {
      const fileStream = fs.createReadStream(file.filepath);
      const formData = new FormData();
      formData.append("resume", fileStream, file.originalFilename);
      // Forward to Flask backend
      const flaskRes = await axios.post(
        "http://localhost:5000/api/check-resume",
        formData,
        { headers: formData.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity }
      );
      res.json(flaskRes.data);
    } catch (e) {
      if (e.response && e.response.data) {
        res.status(e.response.status).json(e.response.data);
      } else {
        res.status(500).json({ error: "Failed to proxy to Python backend: " + e.message });
      }
    }
  });
});

// --- Start server ---
app.listen(3001, () => console.log("Server running on http://localhost:3001"));
