import { useState, useRef, useEffect, useMemo } from "react";
import axios from "axios";


export default function App() {
  // Inputs
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [jobDesc, setJobDesc] = useState("");

  // UI state
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dark, setDark] = useState(false);

  const fileInputRef = useRef();

  // Loading text
  const loadingSteps = [
    "Parsing your resume…",
    "Analyzing structure & keywords…",
    "Generating insights…",
  ];

  useEffect(() => {
    let timeout;
    if (loading) {
      setLoadingStep(0);
      const stepDurations = [2200, 3200, 2200];
      let current = 0;
      const next = () => {
        timeout = setTimeout(() => {
          current = (current + 1) % loadingSteps.length;
          setLoadingStep(current);
          next();
        }, stepDurations[current]);
      };
      next();
    } else {
      setLoadingStep(0);
    }
    return () => clearTimeout(timeout);
  }, [loading]);

  // Theme
  const colors = dark
    ? {
      bg: "#0b1220",
      card: "#111928",
      text: "#e5e7eb",
      subtext: "#9ca3af",
      accent: "#60a5fa",
      accent2: "#22c55e",
      warn: "#fbbf24",
      danger: "#f87171",
      border: "#1f2937",
      chipGoodBg: "#052e1a",
      chipGoodText: "#86efac",
      chipBadBg: "#331010",
      chipBadText: "#fca5a5",
      chipNeutralBg: "#1f2937",
      chipNeutralText: "#d1d5db",
    }
    : {
      bg: "#f5f7fb",
      card: "#ffffff",
      text: "#111827",
      subtext: "#6b7280",
      accent: "#3b82f6",
      accent2: "#22c55e",
      warn: "#eab308",
      danger: "#ef4444",
      border: "#e5e7eb",
      chipGoodBg: "#ecfdf5",
      chipGoodText: "#065f46",
      chipBadBg: "#fef2f2",
      chipBadText: "#991b1b",
      chipNeutralBg: "#f3f4f6",
      chipNeutralText: "#374151",
    };

  // Drag & Drop
  const [dragOver, setDragOver] = useState(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setFileUrl(f.type === "application/pdf" ? URL.createObjectURL(f) : "");
      setError("");
      setSuccess("");
      setResult(null);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  // JD keyword extraction (simple TF-like freq without libs)
  const extractedKeywords = useMemo(() => {
    const txt = (jobDesc || "").toLowerCase();
    if (!txt.trim()) return [];
    const stop = new Set([
      "the", "and", "for", "with", "from", "that", "this", "have", "has", "are", "was", "were", "will", "can", "all", "not", "but",
      "you", "your", "our", "their", "they", "she", "he", "him", "her", "its", "in", "on", "at", "to", "of", "a", "an", "is", "as", "by",
      "or", "be", "we", "i", "it", "if", "so", "do", "does", "did", "which", "who", "whom", "about", "into", "out", "up", "down", "over",
      "under", "more", "less", "than", "then", "also", "may", "such", "other", "these", "those", "my", "me", "us", "them", "his", "hers",
      "ours", "yours", "theirs", "job", "work", "role", "team", "skills", "requirements", "responsibilities", "years", "experience",
      "candidate", "strong", "using", "knowledge", "preferred", "preferred", "etc", "must", "nice", "plus", "good", "great", "best",
    ]);
    const words = txt.match(/[a-z0-9+#.]+/g) || [];
    const freq = {};
    for (const w of words) {
      if (w.length < 3 || stop.has(w)) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([w]) => w);
  }, [jobDesc]);

  // Upload + analyze
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

    // Send JD keywords if present (comma-separated for your Node backend)
    if (extractedKeywords.length) {
      formData.append("keywords", extractedKeywords.join(","));
    }

    const minDelay = (ms) => new Promise((res) => setTimeout(res, ms));
    try {
      const [res] = await Promise.all([
        axios.post("/api/check-resume", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        }),
        minDelay(1200),
      ]);
      setResult(res.data);
      setSuccess("Analysis complete!");
    } catch (e) {
      setError(e?.response?.data?.error || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setFileUrl(f && f.type === "application/pdf" ? URL.createObjectURL(f) : "");
    setError("");
    setSuccess("");
    setResult(null);
  };

  // Export helpers
  const downloadJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = (file?.name || "resume").replace(/\.[^.]+$/, "");
    a.download = `${name}-ats-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  // Derived UI data
  const score = typeof result?.score === "number" ? Math.max(0, Math.min(100, result.score)) : null;

  // Optional breakdowns (if your API sends breakdown object). Fallback to estimates.
  const breakdown = result?.breakdown || {
    keywords: clampPercent(result?.keywordsScore ?? estimateFromHints(result, "keywords")),
    structure: clampPercent(result?.structureScore ?? estimateFromHints(result, "structure")),
    formatting: clampPercent(result?.formattingScore ?? estimateFromHints(result, "formatting")),
    readability: clampPercent(result?.readabilityScore ?? estimateFromHints(result, "readability")),
  };

  // Keyword chips
  const foundKeywords = result?.foundKeywords || [];
  const missingKeywords = result?.missingKeywords || [];
  const neutralKeywords =
    !foundKeywords.length && !missingKeywords.length ? extractedKeywords : [];

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text }}>
      {/* Loading Overlay */}
      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: dark ? "rgba(17,24,39,0.75)" : "rgba(255,255,255,0.85)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 700,
            color: colors.accent,
          }}
        >
          <span
            className="loader"
            style={{
              marginBottom: 20,
              border: `4px solid ${colors.border}`,
              borderTop: `4px solid ${colors.accent}`,
              borderRadius: "50%",
              width: 54,
              height: 54,
              display: "inline-block",
              animation: "spin 1s linear infinite",
            }}
          />
          <div>{loadingSteps[loadingStep]}</div>
        </div>
      )}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: colors.card,
          boxShadow: dark ? "0 1px 0 #111" : "0 1px 0 #e5e7eb",
          width: "100%",
          padding: "12px 0" // Adjusted padding
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between", // Changed to space-between
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="/download.jpeg" alt="ResuMate" style={{ height: 34, borderRadius: 6 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>ResuMate</div>
              <div style={{ fontSize: 14, color: colors.subtext, marginTop: 2 }}>
                Where Your Career Meets the Perfect Resume.
              </div>
            </div>
          </div>

          <button
            onClick={() => setDark((v) => !v)}
            style={{
              ...btnStyle(colors),
              minWidth: "80px", // Set minimum width
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              marginRight: 60, 
            }}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
          >
            {dark ? (
              <>
                <span>Light</span>
                <SunIcon />
              </>
            ) : (
              <>
                <span>Dark</span>
                <MoonIcon />
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ width: "100%", maxWidth: "1200px", margin: "24px auto", padding: "0 24px", boxSizing: "border-box" }}>
        {/* Controls */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", // Add minmax
          gap: 70,
          width: "100%",
          height: "77vh",
          marginTop: -10,
          overflow: "hidden" // Prevent horizontal overflow
        }}>
          {/* Upload + Actions */}
          <div style={card(colors)}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                style={{ display: "none" }}
                disabled={loading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                style={btnStyle(colors)}
              >
                {file ? "Change File" : "Select Resume"}
              </button>
              <span style={{ color: colors.subtext, fontSize: 14 }}>
                {file ? file.name : "No file selected"}
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={handleUpload}
                disabled={loading || !file}
                style={{
                  ...btnStyle(colors),
                  background: colors.accent,
                  color: "#fff",
                }}
              >
                {loading ? "Checking…" : "Check ATS"}
              </button>
            </div>

            {/* Drag & Drop */}
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              style={{
                marginTop: 16,
                padding: 20,
                borderRadius: 10,
                border: `2px dashed ${dragOver ? colors.accent : colors.border}`,
                background: dragOver ? alpha(colors.accent, 0.06) : "transparent",
                textAlign: "center",
                color: colors.subtext,
                fontSize: 14,
              }}
            >
              Drag & drop your resume PDF/DOCX here
            </div>

            {/* Job Description */}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Job Description (optional)</div>
              <textarea
                placeholder="Paste a job description to match keywords…"
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                rows={5}
                style={{
                  width: "95%",
                  resize: "vertical",
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  padding: 12,
                  fontFamily: "inherit",
                  background: dark ? "#0b1220" : "#fff",
                  color: colors.text,
                }}
              />
              {/* JD extracted keywords preview */}
              {extractedKeywords.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13, color: colors.subtext, marginBottom: 6 }}>
                    Extracted keywords we'll try to match:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {extractedKeywords.map((k) => (
                      <span
                        key={k}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 16,
                          background: colors.chipNeutralBg,
                          color: colors.chipNeutralText,
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Alerts */}
            {error && (
              <div style={banner(colors.danger, dark)}>
                <strong>Error:</strong> {error}
              </div>
            )}
            {success && (
              <div style={banner(colors.accent2, dark)}>
                <strong>Success:</strong> {success}
              </div>
            )}
          </div>

          {/* Preview */}
          <div style={card(colors)}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Resume Preview</div>
            {fileUrl ? (
              // Update iframe styling
              <iframe
                src={fileUrl}
                style={{
                  width: "100%",
                  height: "500px",
                  maxHeight: "70vh", // Limit height on small screens
                  maxWidth: "110vh",
                  border: "none",
                  borderRadius: 10,
                  background: dark ? "#0b1220" : "#f1f5f9",
                }}
              />
            ) : file ? (
              <div
                style={{
                  width: "100%",
                  minHeight: 420,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.subtext,
                  fontSize: 14,
                  border: `1px dashed ${colors.border}`,
                }}
              >
                DOCX preview not supported. File: {file.name}
              </div>
            ) : (
              <div style={{ color: colors.subtext, fontSize: 14, marginTop: 16 }}>
                No resume selected
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {result && (
          <section style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Score + Breakdown + Exports */}
            <div style={card(colors)}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <ScoreGauge score={score ?? 0} colors={colors} />
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
                    ATS Compatibility Score
                  </div>
                  <div style={{ fontSize: 13, color: colors.subtext, marginBottom: 10 }}>
                    {scoreCopy(score ?? 0)}
                  </div>

                  {/* Breakdown bars */}
                  <BreakdownBar label="Keywords" value={breakdown.keywords} colors={colors} />
                  <BreakdownBar label="Structure" value={breakdown.structure} colors={colors} />
                  <BreakdownBar label="Formatting" value={breakdown.formatting} colors={colors} />
                  <BreakdownBar label="Readability" value={breakdown.readability} colors={colors} />
                </div>
              </div>

              {/* Export */}
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button onClick={printReport} style={btnStyle(colors)}>
                  Print Report
                </button>
                <button onClick={downloadJSON} style={btnStyle(colors)}>
                  Download JSON
                </button>
              </div>
            </div>

            {/* Findings */}
            <div style={card(colors)}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Detailed Report</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {(result.details || []).map((d, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: dark ? "#0b1220" : "#f7fafc",
                      marginBottom: 10,
                      fontSize: 15,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>
                      {d.startsWith("❌") ? "❌" : d.startsWith("⚠️") ? "⚠️" : "✔️"}
                    </span>
                    <span>{d.replace(/^✅|^❌|^⚠️/, "").trim()}</span>
                  </li>
                ))}
                {(result.suggestions || []).length > 0 && (
                  <li
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px dashed ${colors.warn}`,
                      background: alpha(colors.warn, 0.08),
                      color: dark ? "#fef08a" : "#92400e",
                      fontWeight: 600,
                      marginTop: 6,
                    }}
                  >
                    Suggestions:
                    <ul style={{ margin: "8px 0 0 18px" }}>
                      {result.suggestions.map((s, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            </div>

            {/* Keywords */}
            <div style={card(colors)}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Keyword Match</div>
              {(foundKeywords.length > 0 || missingKeywords.length > 0) ? (
                <>
                  {foundKeywords.length > 0 && (
                    <>
                      <div style={{ fontSize: 13, color: colors.subtext, marginBottom: 6 }}>
                        Found in your resume:
                      </div>
                      <ChipRow items={foundKeywords} bg={colors.chipGoodBg} color={colors.chipGoodText} />
                    </>
                  )}
                  {missingKeywords.length > 0 && (
                    <>
                      <div style={{ fontSize: 13, color: colors.subtext, margin: "10px 0 6px" }}>
                        Missing / low frequency:
                      </div>
                      <ChipRow items={missingKeywords} bg={colors.chipBadBg} color={colors.chipBadText} />
                    </>
                  )}
                </>
              ) : neutralKeywords.length > 0 ? (
                <>
                  <div style={{ fontSize: 13, color: colors.subtext, marginBottom: 6 }}>
                    Based on the JD you pasted (presence not verified in resume):
                  </div>
                  <ChipRow
                    items={neutralKeywords}
                    bg={colors.chipNeutralBg}
                    color={colors.chipNeutralText}
                  />
                  <div style={{ fontSize: 12, color: colors.subtext, marginTop: 8 }}>
                    Tip: Send these as <code>keywords</code> to your backend to check presence server-side.
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 14, color: colors.subtext }}>
                  No keyword data provided.
                </div>
              )}
            </div>

            {/* Sections */}
            <div style={card(colors)}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Sections Check</div>
              {Array.isArray(result?.missingSections) && result.missingSections.length > 0 ? (
                <>
                  <div style={{ fontSize: 14, color: colors.subtext, marginBottom: 8 }}>
                    Consider adding these sections:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {result.missingSections.map((sec, i) => (
                      <li key={i} style={{ color: colors.danger, fontWeight: 600, marginBottom: 6 }}>
                        {capitalize(sec)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div style={{ fontSize: 14, color: colors.accent2, fontWeight: 700 }}>
                  All core sections present ✅
                </div>
              )}
            </div>
          </section>
        )}

      </main>

      {/* Anim keyframes */}
      <style>{`
        #root {
          width: 100%;
          max-width: none;
          margin: 0;
          padding: 0;
          text-align: left;
        }
          

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

       @media (max-width: 1200px) {
    main > div:first-child { 
      grid-template-columns: 1fr;
      gap: 16px;
    }
    section { 
      grid-template-columns: 1fr !important; 
    }
    .card {
      padding: 16px;
    }
  }
  
  @media (max-width: 768px) {
    main {
      padding: 0 16px;
    }
    .card {
      padding: 12px;
    }
  }
      `}</style>
    </div>
  );
}

function ScoreGauge({ score, colors }) {
  const radius = 56;
  const stroke = 10;
  const c = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  const bg = c - dash;

  const band = pct >= 80 ? colors.accent2 : pct >= 60 ? colors.warn : colors.danger;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ display: "block" }}>
      <g transform="translate(70,70) rotate(-90)">
        <circle r={radius} fill="none" stroke={alpha(colors.text, 0.12)} strokeWidth={stroke} />
        <circle
          r={radius}
          fill="none"
          stroke={band}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${bg}`}
          strokeLinecap="round"
        />
      </g>
      <text x="70" y="70" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 26, fontWeight: 800, fill: colors.text }}>
        {pct}
      </text>
      <text x="70" y="96" textAnchor="middle" style={{ fontSize: 12, fill: colors.subtext }}>
        / 100
      </text>
    </svg>
  );
}

function BreakdownBar({ label, value, colors }) {
  const v = clampPercent(value);
  const band = v >= 80 ? colors.accent2 : v >= 60 ? colors.warn : colors.danger;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span style={{ color: colors.subtext }}>{v}%</span>
      </div>
      <div style={{ height: 12, background: alpha(colors.text, 0.1), borderRadius: 8, overflow: "hidden" }}>
        <div style={{ width: `${v}%`, height: "100%", background: band }} />
      </div>
    </div>
  );
}

function ChipRow({ items, bg, color }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((k, i) => (
        <span
          key={`${k}-${i}`}
          style={{
            padding: "6px 10px",
            borderRadius: 16,
            background: bg,
            color,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {k}
        </span>
      ))}
    </div>
  );
}

/* ---------- Style helpers ---------- */
function card(colors) {
  return {
    background: colors.card,
    borderRadius: 14,
    border: `1px solid ${colors.border}`,
    padding: 20,
    boxShadow: "0 6px 24px rgba(0,0,0,0.04)",
    width: "100%",
    boxSizing: "border-box", // Include padding in width
    overflow: "hidden" // Prevent content from overflowing
  };
}

function btnStyle(colors) {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    background: colors.card,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    fontWeight: 700,
    cursor: "pointer",
  };
}

function banner(color, dark) {
  return {
    marginTop: 14,
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    border: `1px solid ${color}`,
    background: dark ? alpha(color, 0.12) : alpha(color, 0.08),
  };
}

function alpha(hexOrRgb, a) {
  // Accept hex like #22c55e or rgb string; fall back to rgba(0,0,0,a)
  if (typeof hexOrRgb !== "string") return `rgba(0,0,0,${a})`;
  if (hexOrRgb.startsWith("rgb")) {
    return hexOrRgb.replace("rgb(", "rgba(").replace(")", `, ${a})`);
  }
  const hex = hexOrRgb.replace("#", "");
  const bigint = parseInt(hex.length === 3 ? hex.split("").map(x => x + x).join("") : hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function clampPercent(v) {
  const n = Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function estimateFromHints(result, kind) {
  // Fallback estimations if backend doesn't send breakdown
  const details = (result?.details || []).join(" ").toLowerCase();

  if (kind === "keywords") {
    if (details.includes("no relevant keywords") || details.includes("very few")) return 35;
    if (details.includes("only some")) return 60;
    if (details.includes("multiple relevant keywords")) return 85;
    return 55;
  }
  if (kind === "structure") {
    if (details.includes("missing one or more key sections")) return 45;
    if (details.includes("all standard sections present")) return 85;
    return 60;
  }
  if (kind === "formatting") {
    if (details.includes("tables") || details.includes("columns") || details.includes("images")) return 40;
    if (details.includes("bullet points")) {
      if (details.includes("few") || details.includes("not enough")) return 55;
      if (details.includes("sufficient")) return 85;
    }
    return 65;
  }
  if (kind === "readability") {
    // infer from word count hints
    if (details.includes("too short") || details.includes("too long")) return 55;
    if (details.includes("good length")) return 80;
    return 65;
  }
  return 60;
}

function capitalize(s) {
  return (s || "").slice(0, 1).toUpperCase() + (s || "").slice(1);
}

function scoreCopy(score) {
  if (score < 40) return "Very low ATS compatibility. Major improvements needed.";
  if (score < 50) return "Low compatibility. Add detail, bullets, and job-specific keywords.";
  if (score < 60) return "Below average. Improve structure, quantify results, add keywords.";
  if (score < 70) return "Getting closer! Add more job-aligned skills and clearer formatting.";
  if (score < 80) return "Decent! Tweak keywords and clarity for a stronger match.";
  if (score < 90) return "Good! A few targeted tweaks could lift your score further.";
  return "Excellent! Highly ATS-friendly. Tailor to each job for best results.";
}

// Add these above your App component
const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

