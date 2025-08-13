
import { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function App() {

  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef();

  // Animated loading steps
  const loadingSteps = [
    "Parsing your CV...",
    "Analyzing your experience...",
    "Generating the report..."
  ];

  useEffect(() => {
    let timeout;
    if (loading) {
      setLoadingStep(0);
      const stepDurations = [2500, 3500, 2500]; // ms for each step
      let currentStep = 0;
      function nextStep() {
        timeout = setTimeout(() => {
          currentStep = (currentStep + 1) % loadingSteps.length;
          setLoadingStep(currentStep);
          nextStep();
        }, stepDurations[currentStep]);
      }
      nextStep();
    } else {
      setLoadingStep(0);
    }
    return () => clearTimeout(timeout);
  }, [loading]);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a PDF or DOCX resume.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    setResult(null);
    const formData = new FormData();
    formData.append("resume", file);
    const minDelay = ms => new Promise(res => setTimeout(res, ms));
    try {
      const [res] = await Promise.all([
        axios.post("http://localhost:5000/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        }),
        minDelay(1500) // Always show spinner for at least 1s
      ]);
      setResult(res.data);
      setSuccess("Upload and analysis complete!");
    } catch (e) {
      setError(e.response?.data?.error || "Upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setFileUrl(f ? URL.createObjectURL(f) : "");
  };

  // Theme colors
  const colors = {
    bg: "#f7f8fa",
    card: "#fff",
    accent: "#3e7bfa",
    text: "#232946",
    subtext: "#6b7280",
    button: "#3e7bfa",
    buttonText: "#fff",
    error: "#ff6f61",
    success: "#22c55e",
    border: "#e5e7eb"
  };

  return (
  <div style={{ minHeight: '100vh', minWidth: '100vw', background: '#f4f7fb', fontFamily: 'Inter, Segoe UI, sans-serif', padding: 0, margin: 0, boxSizing: 'border-box', position: 'relative' }}>
      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(255,255,255,0.85)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 600,
          color: '#3e7bfa',
          letterSpacing: 0.2,
          transition: 'all 0.20s'
        }}>
          <span className="loader" style={{
            marginBottom: 32,
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3e7bfa',
            borderRadius: '50%',
            width: 54,
            height: 54,
            display: 'inline-block',
            animation: 'spin 1s linear infinite',
            verticalAlign: 'middle'
          }}></span>
          <div style={{ minHeight: 40, transition: 'opacity 0.4s', opacity: 1 }}>
            {loadingSteps[loadingStep]}
          </div>
        </div>
      )}
      {/* Header */}
      <header style={{ width: '100%', background: '#fff', boxShadow: '0 2px 12px #0001', padding: '32px 0 18px 0', marginBottom: 32 }}>
        <div style={{ width: '100%', maxWidth: '100%', margin: 0, padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="/download.jpeg" alt="ATS Resume Checker" style={{ height: 38, marginBottom: 10 }} />
          <h1 style={{ color: '#232946', fontWeight: 800, fontSize: 36, margin: 0, letterSpacing: 0.5 }}>ResuMate</h1>
          <div style={{ color: '#6b7280', fontSize: 18, marginTop: 8, fontWeight: 500, textAlign: 'center', maxWidth: 600 }}>
            Instantly check your resume for ATS compatibility and get actionable feedback to improve your chances of landing interviews.
          </div>
        </div>
      </header>
      <div style={{ width: '100%', minHeight: 'calc(100vh - 120px)', display: 'flex', gap: 40, alignItems: 'flex-start', justifyContent: 'center', boxSizing: 'border-box', padding: '0 20px' }}>
        {/* Report Card */}
        <div style={{ flex: 1.2, background: '#fff', borderRadius: 18, boxShadow: '0 6px 32px #0002', padding: 44, border: 'none', minWidth: 420, maxWidth: 'none' }}>
          <div style={{ marginBottom: 30, display: 'flex', gap: 16, alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={loading}
            />
            <button
              onClick={() => fileInputRef.current.click()}
              disabled={loading}
              style={{ padding: '10px 22px', background: colors.button, color: colors.buttonText, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 2px 8px #0002', opacity: loading ? 0.7 : 1 }}
            >
              {file ? 'Change File' : 'Select Resume'}
            </button>
            <span style={{ color: colors.subtext, fontSize: 15 }}>{file ? file.name : 'No file selected'}</span>
            <button
              onClick={handleUpload}
              disabled={loading || !file}
              style={{ padding: '10px 22px', background: colors.accent, color: colors.buttonText, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 2px 8px #0002', opacity: loading ? 0.7 : 1, marginLeft: 8 }}
            >
              {loading ? (
                <span>
                  <span className="loader" style={{ marginRight: 8, border: '2px solid #fff', borderTop: '2px solid ' + colors.buttonText, borderRadius: '50%', width: 16, height: 16, display: 'inline-block', animation: 'spin 1s linear infinite', verticalAlign: 'middle' }}></span>
                  Checking...
                </span>
              ) : 'Check ATS'}
            </button>
          </div>
          {error && <div style={{ color: colors.error, marginBottom: 14, textAlign: 'left', fontWeight: 500 }}>{error}</div>}
          {success && <div style={{ color: colors.success, marginBottom: 14, textAlign: 'left', fontWeight: 500 }}>{success}</div>}
          {result && (
            <div style={{ marginTop: 18 }}>
              {/* Score and Progress Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
                <div style={{ fontSize: 54, fontWeight: 800, color: result.score > 70 ? '#22c55e' : result.score >= 60 ? '#facc15' : '#ff6f61', minWidth: 90, textAlign: 'center' }}>{result.score}/100</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, color: '#232946', fontWeight: 700, marginBottom: 6 }}>ATS Compatibility Score</div>
                  <div style={{ width: '100%', height: 16, background: '#e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 2 }}>
                    <div style={{ width: `${result.score}%`, height: '100%', background: result.score > 70 ? '#22c55e' : result.score >= 60 ? '#facc15' : '#ff6f61', transition: 'width 0.5s', borderRadius: 8 }}></div>
                  </div>
                  <div style={{ fontSize: 14, color: '#6b7280', fontWeight: 500 }}>
                    {result.score < 40 && 'Very low ATS compatibility. Major improvements are needed. Add missing sections, contact info, and relevant keywords.'}
                    {result.score >= 40 && result.score < 50 && 'Low ATS compatibility. Add more details, use bullet points, and include job-specific keywords.'}
                    {result.score >= 50 && result.score < 60 && 'Below average. Tailor your resume with more relevant skills, achievements, and clear formatting.'}
                    {result.score >= 60 && result.score < 70 && 'Getting closer! Add more job-specific keywords, quantify achievements, and improve structure.'}
                    {result.score >= 70 && result.score < 80 && 'Decent! Your resume is somewhat ATS-friendly, but can be improved with more keywords and clarity.'}
                    {result.score >= 80 && result.score < 90 && 'Good! Your resume is ATS-friendly, but a few targeted tweaks could make it even better.'}
                    {result.score >= 90 && 'Excellent! Your resume is highly ATS-friendly. Review the suggestions for a final polish and tailor for each job.'}
                  </div>
                </div>
              </div>
              {/* Detailed Report */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 12, color: '#232946', letterSpacing: 0.2 }}>Detailed ATS Report</div>
                <ul style={{ paddingLeft: 0, color: '#232946', fontSize: 17, margin: 0, listStyle: 'none' }}>
                  {result.details?.map((d, i) => (
                    <li key={i} style={{ marginBottom: 14, display: 'flex', alignItems: 'center', background: '#f7fafc', borderRadius: 8, padding: '10px 16px', boxShadow: '0 1px 4px #0001' }}>
                      <span style={{ fontSize: 22, marginRight: 12 }}>{d.startsWith('✅') ? '✔️' : d.startsWith('❌') ? '❌' : 'ℹ️'}</span>
                      <span style={{ color: d.startsWith('❌') ? '#ff6f61' : '#232946', fontWeight: 500 }}>{d.replace(/^✅|^❌/,'')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
        {/* Resume Preview */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 18, boxShadow: '0 6px 32px #0002', padding: 32, minHeight: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', border: 'none', maxWidth: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#3e7bfa', marginBottom: 18, letterSpacing: 0.2 }}>Resume Preview</div>
          {fileUrl ? (
            file && file.type === 'application/pdf' ? (
              <iframe src={fileUrl} title="Resume PDF Preview" style={{ width: '100%', height: 520, border: 'none', borderRadius: 10, background: '#f1f5f9', boxShadow: '0 2px 8px #0001' }} />
            ) : (
              <div style={{ width: '100%', minHeight: 520, background: '#f1f5f9', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 18, boxShadow: '0 2px 8px #0001' }}>
                DOCX preview not supported. File: {file.name}
              </div>
            )
          ) : (
            <div style={{ color: '#6b7280', fontSize: 18, marginTop: 40 }}>No resume selected</div>
          )}
        </div>
      </div>
    </div>
  );
}
