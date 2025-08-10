const express = require("express");
const cors = require("cors");
const formidable = require("formidable");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const app = express();
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true
}));

const readFile = (file) => fs.promises.readFile(file.filepath);

function analyzeResume(text, customKeywords = []) {
  let score = 100;
  let details = [];
  let suggestions = [];
  let highlights = [];

  // Use custom keywords if provided, otherwise extract likely keywords from the resume
  let keywords = customKeywords.length > 0 ? customKeywords.map(k => k.toLowerCase()) : [];
  const lowerText = text.toLowerCase();
  if (keywords.length === 0) {
    // Try to extract keywords from sections like 'Skills', 'Core Competencies', 'Expertise', etc.
    const skillSection = text.match(/(skills|core competencies|expertise|areas of expertise|proficiencies)[\s\S]{0,200}/i);
    if (skillSection) {
      keywords = skillSection[0].split(/[,\n•\-]/).map(s => s.trim().toLowerCase()).filter(s => s.length > 2);
    }
    // If still empty, fallback to most frequent non-stopwords
    if (keywords.length === 0) {
      const stopwords = ["the","and","for","with","from","that","this","have","has","are","was","were","will","can","all","not","but","you","your","our","their","they","she","he","him","her","its","it's","in","on","at","to","of","a","an","is","as","by","or","be","we","i","it","if","so","do","does","did","which","who","whom","about","into","out","up","down","over","under","more","less","than","then","also","may","such","other","these","those","my","me","us","them","his","hers","ours","yours","theirs","job","work","resume","cv","curriculum","vitae","summary","objective","experience","education","skills","project","projects","company","companies","role","position","responsibilities","responsibility","duties","duty","achievement","achievements","award","awards","certification","certifications","certificate","certificates","degree","degrees","school","university","college","institute","organization","organizations","employer","employers","employment","history","background","profile","contact","address","phone","email"];
      const words = lowerText.split(/[^a-zA-Z0-9]/).filter(w => w.length > 2 && !stopwords.includes(w));
      const freq = {};
      words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
      keywords = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,10).map(([w]) => w);
    }
  }

  // Contact info
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phone = text.match(/\+?\d[\d\s-]{7,}/);
  if (!(email && phone)) {
    score -= 20;
    details.push("❌ Missing email or phone.");
    suggestions.push("Add a professional email and phone number to the top of your resume.");
    // Highlight lines missing email/phone
    const lines = text.split(/\r?\n/);
    const emailLine = lines.find(line => /@/.test(line));
    const phoneLine = lines.find(line => /\+?\d[\d\s-]{7,}/.test(line));
    if (!emailLine) highlights.push({ reason: "Missing email", line: lines[0] || "(top of resume)" });
    if (!phoneLine) highlights.push({ reason: "Missing phone", line: lines[0] || "(top of resume)" });
  } else {
    details.push("✅ Contact info found.");
  }

  // Section headings (require all 3 for full points)
  const headings = ["education", "experience", "skills"];
  const found = headings.filter(h => lowerText.includes(h));
  if (found.length !== 3) {
    score -= 30;
    details.push("❌ Missing one or more key sections (Education, Experience, Skills).");
    const lines = text.split(/\r?\n/);
    if (!lowerText.includes("education")) {
      suggestions.push("Add an 'Education' section with your degrees, schools, and graduation dates.");
      highlights.push({ reason: "Missing Education section", line: lines.find(l => /education/i.test(l)) || lines[0] || "(top of resume)" });
    }
    if (!lowerText.includes("experience")) {
      suggestions.push("Add a 'Work Experience' section with job titles, companies, and dates.");
      highlights.push({ reason: "Missing Experience section", line: lines.find(l => /experience/i.test(l)) || lines[0] || "(top of resume)" });
    }
    if (!lowerText.includes("skills")) {
      suggestions.push("Add a 'Skills' section listing your relevant technical and soft skills.");
      highlights.push({ reason: "Missing Skills section", line: lines.find(l => /skills/i.test(l)) || lines[0] || "(top of resume)" });
    }
  } else {
    details.push("✅ All standard sections present (Education, Experience, Skills).");
  }

  // Word count (stricter)
  const words = text.split(/\s+/).length;
  if (words < 200) {
    score -= 15;
    details.push(`❌ Too short: ${words} words.`);
    suggestions.push("Expand your resume to at least 200 words. Add more detail to your experience and skills.");
    highlights.push({ reason: "Too short", line: "Resume is too short (" + words + " words)" });
  } else if (words > 700) {
    score -= 15;
    details.push(`❌ Too long: ${words} words.`);
    suggestions.push("Condense your resume to under 700 words. Remove unnecessary details and focus on achievements.");
    highlights.push({ reason: "Too long", line: "Resume is too long (" + words + " words)" });
  } else {
    details.push(`✅ Good length: ${words} words.`);
  }

  // Bullet points (stricter)
  const bullets = (text.match(/[\u2022\-•]/g) || []).length;
  if (bullets < 5) {
    score -= 15;
    details.push("❌ Few or no bullet points.");
    suggestions.push("Use bullet points for each job and project to make your resume easier to scan.");
    highlights.push({ reason: "Too few bullet points", line: "Found only " + bullets + " bullet points" });
  } else if (bullets < 10) {
    score -= 10;
    details.push("❌ Not enough bullet points (aim for 10+).");
    suggestions.push("Use more bullet points to describe your achievements and responsibilities (aim for 10+).");
    highlights.push({ reason: "Not enough bullet points", line: "Found only " + bullets + " bullet points" });
  } else {
    details.push("✅ Sufficient bullet points used.");
  }

  // Keywords (require at least 3 for full points)
  const foundKeywords = keywords.filter(k => lowerText.includes(k));
  if (foundKeywords.length < 1) {
    score -= 40;
    details.push("❌ No relevant keywords found.");
    suggestions.push("Include keywords and skills from the job description or your field to pass ATS filters.");
    highlights.push({ reason: "No relevant keywords", line: "No relevant keywords found in resume" });
  } else if (foundKeywords.length < 3) {
    score -= 35;
    details.push(`❌ Very few relevant keywords found: ${foundKeywords.join(", ")}`);
    suggestions.push("Add more industry-specific keywords and skills to your resume.");
    highlights.push({ reason: "Very few relevant keywords", line: foundKeywords.join(", ") });
  } else if (foundKeywords.length < 5) {
    score -= 25;
    details.push(`❌ Only some relevant keywords found: ${foundKeywords.join(", ")}`);
    suggestions.push("Add more job-relevant keywords from the job description or your field to your resume.");
    highlights.push({ reason: "Only some relevant keywords", line: foundKeywords.join(", ") });
  } else {
    details.push(`✅ Multiple relevant keywords found: ${foundKeywords.join(", ")}`);
  }

  // Penalize for images, tables, or columns (common ATS blockers)
  if (/\btable|column|image|img\b/i.test(lowerText)) {
    score -= 10;
    details.push("❌ Detected possible tables, columns, or images (avoid these for ATS).");
    suggestions.push("Remove tables, columns, and images. Use simple text formatting for best ATS results.");
    highlights.push({ reason: "ATS blockers detected", line: "Tables, columns, or images detected in resume" });
  }

  // Penalize for using uncommon fonts or colors (not directly detectable, but warn)
  suggestions.push("Use standard fonts (Arial, Calibri, Times New Roman) and black text for best ATS compatibility.");

  // Cap score at 95, minimum 0
  if (score > 95) score = 95;
  if (score < 0) score = 0;
  // Always add a generic suggestion and error if score is 95 (i.e., perfect resume)
  if (score === 95) {
    details.push("❌ No resume is ever truly perfect. Consider tailoring your resume for each job and keep improving!");
    suggestions.push("Even strong resumes can be improved. Try customizing your resume for each application, quantifying achievements, and seeking feedback from others.");
    highlights.push({ reason: "General improvement", line: "Review your resume for further tailoring and polish." });
  }
  return { score, details, suggestions, highlights };
}

app.post("/upload", (req, res) => {
  console.log('Request headers:', req.headers);
  const form = new formidable.IncomingForm({ keepExtensions: true, multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "File upload error: " + err.message });

    console.log('All uploaded files:', files);
    // Try to get the file from 'resume' or any other field, and handle array case
    let file = files.resume || Object.values(files)[0];
    if (Array.isArray(file)) file = file[0];
    let text = "";

    try {
      console.log('Received upload:', file);
      if (!file || !file.originalFilename) {
        console.error('No file uploaded or file is invalid.');
        return res.status(400).json({ error: "No file uploaded or file is invalid. (Field name: 'resume' or first file in files object)" });
      }
      const filename = file.originalFilename.toLowerCase();
      console.log('Processing file:', filename);
      console.log('File properties:', {
        filepath: file.filepath,
        mimetype: file.mimetype,
        size: file.size
      });
      if (filename.endsWith(".pdf")) {
        let buffer;
        try {
          buffer = await readFile(file);
        } catch (readErr) {
          console.error('Error reading PDF file:', readErr);
          return res.status(500).json({ error: "Failed to read PDF file: " + readErr.message });
        }
        if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
          console.error('PDF buffer is empty or invalid.');
          return res.status(500).json({ error: "Uploaded PDF file is empty or invalid." });
        }
        console.log('PDF buffer length:', buffer.length);
        try {
          const data = await pdfParse(buffer);
          text = data.text;
          console.log('PDF text length:', text.length);
        } catch (pdfErr) {
          console.error('Error parsing PDF:', pdfErr);
          return res.status(500).json({ error: "Failed to parse PDF: " + pdfErr.message });
        }
      } else if (filename.endsWith(".docx")) {
        let buffer;
        try {
          buffer = await readFile(file);
        } catch (readErr) {
          console.error('Error reading DOCX file:', readErr);
          return res.status(500).json({ error: "Failed to read DOCX file: " + readErr.message });
        }
        if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
          console.error('DOCX buffer is empty or invalid.');
          return res.status(500).json({ error: "Uploaded DOCX file is empty or invalid." });
        }
        try {
          const result = await mammoth.extractRawText({ buffer });
          text = result.value;
          console.log('DOCX text length:', text.length);
        } catch (docxErr) {
          console.error('Error parsing DOCX:', docxErr);
          return res.status(500).json({ error: "Failed to parse DOCX: " + docxErr.message });
        }
      } else {
        console.error('Unsupported file type:', filename);
        return res.status(400).json({ error: "Only PDF or DOCX files are allowed." });
      }

      // Accept keywords from frontend (fields.keywords as comma-separated string or array)
      let customKeywords = [];
      if (fields.keywords) {
        if (Array.isArray(fields.keywords)) {
          customKeywords = fields.keywords;
        } else if (typeof fields.keywords === 'string') {
          customKeywords = fields.keywords.split(',').map(k => k.trim()).filter(Boolean);
        }
      }

      const analysis = analyzeResume(text, customKeywords);
      res.json({ ok: true, ...analysis });

    } catch (e) {
      console.error('General error:', e);
      res.status(500).json({ error: "Failed to process file: " + e.message });
    }
  });
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));
