import json
import os
from flask import Flask, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pdfplumber
from docx import Document
import re

app = Flask(__name__)

# Load dataset
DATASET_PATH = os.path.join(os.path.dirname(__file__), '../resumes_dataset.jsonl')
resumes = []
texts = []

with open(DATASET_PATH, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        text = f"{data.get('Summary', '')} {data.get('Skills', '')} {data.get('Experience', '')} {data.get('Education', '')}"
        resumes.append(data)
        texts.append(text)

vectorizer = TfidfVectorizer(stop_words='english')
X = vectorizer.fit_transform(texts)


def extract_text_from_pdf(file_stream):
    text = ""
    with pdfplumber.open(file_stream) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text


def extract_text_from_docx(file_stream):
    doc = Document(file_stream)
    return "\n".join([p.text for p in doc.paragraphs])


@app.route('/api/check-resume', methods=['POST'])
def check_resume():
    if 'resume' not in request.files:
        return jsonify({'error': 'No resume file provided'}), 400
    file = request.files['resume']
    filename = file.filename.lower()

    if filename.endswith('.pdf'):
        resume_text = extract_text_from_pdf(file)
    elif filename.endswith('.docx'):
        resume_text = extract_text_from_docx(file)
    else:
        return jsonify({'error': 'Unsupported file type. Please upload PDF or DOCX.'}), 400

    if not resume_text.strip():
        return jsonify({'error': 'No text extracted from resume.'}), 400

    details = []
    total_score = 0
    weights = {
        "sections": 20,
        "bullets": 15,
        "contact": 15,
        "length": 10,
        "dataset_similarity": 25,
        "formatting": 10,
        "grammar": 5
    }

    # --- Section completeness ---
    headings = ["education", "experience", "skills", "projects", "summary", "contact"]
    found_sections = sum(1 for h in headings if h in resume_text.lower())
    section_score = (found_sections / len(headings)) * weights["sections"]
    details.append(f"Sections found: {found_sections}/{len(headings)}")
    total_score += section_score

    # --- Bullet point usage ---
    bullet_count = len(re.findall(r"[•\-\u2022]", resume_text))
    if bullet_count >= 7:
        bullet_score = weights["bullets"]
    elif bullet_count >= 3:
        bullet_score = weights["bullets"] * 0.7
    else:
        bullet_score = weights["bullets"] * 0.3
    details.append(f"Bullet points used: {bullet_count}")
    total_score += bullet_score

    # --- Contact info ---
    email = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", resume_text, re.I)
    phone = re.search(r"\+?\d[\d\s-]{7,}", resume_text)
    contact_score = 0
    if email:
        contact_score += weights["contact"] * 0.5
    if phone:
        contact_score += weights["contact"] * 0.5
    details.append(f"Email: {'Yes' if email else 'No'}, Phone: {'Yes' if phone else 'No'}")
    total_score += contact_score

    # --- Length check ---
    word_count = len(resume_text.split())
    if 200 <= word_count <= 800:
        length_score = weights["length"]
    elif 150 <= word_count < 200 or 800 < word_count <= 1000:
        length_score = weights["length"] * 0.7
    else:
        length_score = weights["length"] * 0.3
    details.append(f"Word count: {word_count}")
    total_score += length_score

    # --- Dataset similarity ---
    resume_vec = vectorizer.transform([resume_text])
    similarity = cosine_similarity(resume_vec, X).max()
    dataset_score = similarity * weights["dataset_similarity"]
    details.append(f"Similarity to ATS-optimized dataset: {similarity:.2f}")
    total_score += dataset_score

    # --- Formatting checks ---
    if re.search(r"\t{2,}", resume_text) or re.search(r"\n\s*\n\s*\n", resume_text):
        formatting_score = weights["formatting"] * 0.5
        details.append("Formatting: Irregular spacing detected.")
    else:
        formatting_score = weights["formatting"]
        details.append("Formatting: Consistent.")
    total_score += formatting_score

    # --- Grammar/Typos (simple heuristic) ---
    typos = len(re.findall(r"\b[a-z]{1,2}\b", resume_text))  # short random words
    if typos < 10:
        grammar_score = weights["grammar"]
    elif typos < 20:
        grammar_score = weights["grammar"] * 0.7
    else:
        grammar_score = weights["grammar"] * 0.3
    details.append(f"Grammar/typo estimate: {typos} potential issues.")
    total_score += grammar_score

    final_score = round(total_score, 2)
    return jsonify({
        'score': final_score,
        'details': details
    })


if __name__ == '__main__':
    app.run(port=5000, debug=True)
