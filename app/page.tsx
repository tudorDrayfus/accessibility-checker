"use client";
import { useState, useRef } from "react";

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Violation = {
  id: string;
  impact: string | null;
  nodes: number;
  boxes: Box[];
  category: string;
  title: string;
  why: string;
  fix: string;
  effort: "Quick win" | "Moderate" | "Complex";
  effortTime: string;
};

const effortConfig = {
  "Quick win": {
    icon: "bolt",
    label: "Quick Wins",
    badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    dot: "bg-emerald-400",
    overlay: "rgba(52, 211, 153, 0.15)",
    stroke: "#34d399",
    activeBg: "bg-emerald-500/[0.07]",
    accentBar: "bg-emerald-400",
  },
  Moderate: {
    icon: "build",
    label: "Moderate",
    badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    dot: "bg-amber-400",
    overlay: "rgba(251, 191, 36, 0.15)",
    stroke: "#fbbf24",
    activeBg: "bg-amber-500/[0.07]",
    accentBar: "bg-amber-400",
  },
  Complex: {
    icon: "architecture",
    label: "Complex",
    badge: "bg-red-500/10 text-red-400 border border-red-500/20",
    dot: "bg-red-400",
    overlay: "rgba(248, 113, 113, 0.15)",
    stroke: "#f87171",
    activeBg: "bg-red-500/[0.07]",
    accentBar: "bg-red-400",
  },
};

function MaterialIcon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size, lineHeight: 1, userSelect: "none" }}
    >
      {name}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 text-zinc-600 hover:text-zinc-300 transition text-xs ml-auto flex-shrink-0"
      title="Copy to clipboard"
    >
      <MaterialIcon name={copied ? "check" : "content_copy"} size={13} />
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export default function Home() {
  const [domain, setDomain] = useState("");
  const [violations, setViolations] = useState<Violation[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(1440);
  const [pageHeight, setPageHeight] = useState(900);
  const [activeViolation, setActiveViolation] = useState<Violation | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  function getFullUrl(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    return `https://www.${trimmed}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullUrl = getFullUrl(domain);
    if (!fullUrl) return;
    setLoading(true);
    setViolations([]);
    setTotal(null);
    setError(null);
    setScannedUrl(null);
    setScreenshot(null);
    setActiveViolation(null);

    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fullUrl }),
    });

    const data = await res.json();
    if (data.error) {
      setError(data.error);
    } else {
      setViolations(data.violations ?? []);
      setTotal(data.total ?? 0);
      setScannedUrl(fullUrl);
      setScreenshot(data.screenshot ?? null);
      setPageWidth(data.pageWidth ?? 1440);
      setPageHeight(data.pageHeight ?? 900);
    }
    setLoading(false);
  }

  const quickWins = violations.filter((v) => v.effort === "Quick win").length;
  const hasResults = total !== null && screenshot;
  const score = Math.max(0, 100 - (total ?? 0) * 5);

  return (
    <main
      className="min-h-screen bg-[#0c0c0c]"
      style={{ fontFamily: "'Noto Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Noto+Sans:wght@300;400;500;600&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@18,300,0,0');

        :root {
          --grid: #1a1a1a;
          --border: #222;
          --surface: #141414;
          --surface2: #181818;
          --text: #e4e4e4;
          --muted: #555;
          --muted2: #333;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }

        .fade-up { animation: fadeUp 0.4s ease both; }
        .fade-up-1 { animation: fadeUp 0.4s 0.08s ease both; }
        .fade-up-2 { animation: fadeUp 0.4s 0.16s ease both; }
        .fade-in { animation: fadeIn 0.3s ease both; }
        .scanning-dot { animation: pulse-dot 1.2s infinite; }

        .bauhaus-grid {
          background-image:
            linear-gradient(var(--grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        .url-bar {
          display: flex;
          align-items: center;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 0;
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .url-bar:focus-within { border-color: #444; }
        .url-prefix {
          padding: 14px 0 14px 16px;
          color: var(--muted);
          font-size: 13px;
          white-space: nowrap;
          user-select: none;
          flex-shrink: 0;
          font-family: 'Noto Sans', sans-serif;
          letter-spacing: 0.01em;
        }
        .url-input {
          flex: 1;
          background: transparent;
          color: var(--text);
          font-size: 13px;
          padding: 14px 8px;
          outline: none;
          border: none;
          font-family: 'Noto Sans', sans-serif;
          letter-spacing: 0.01em;
          min-width: 0;
        }
        .url-input::placeholder { color: #383838; }

        .url-bar-sm {
          display: flex;
          align-items: center;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 0;
          overflow: hidden;
          transition: border-color 0.15s;
          flex: 1;
          min-width: 0;
        }
        .url-bar-sm:focus-within { border-color: #444; }
        .url-prefix-sm {
          padding: 7px 0 7px 10px;
          color: var(--muted);
          font-size: 11px;
          white-space: nowrap;
          user-select: none;
          flex-shrink: 0;
          font-family: 'Noto Sans', sans-serif;
        }
        .url-input-sm {
          flex: 1;
          background: transparent;
          color: var(--text);
          font-size: 11px;
          padding: 7px 6px;
          outline: none;
          border: none;
          font-family: 'Noto Sans', sans-serif;
          min-width: 0;
        }
        .url-input-sm::placeholder { color: #333; }

        .btn-primary {
          background: #e4e4e4;
          color: #0c0c0c;
          font-family: 'Noto Sans', sans-serif;
          font-weight: 500;
          font-size: 13px;
          padding: 14px 24px;
          border: none;
          border-radius: 0;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .btn-primary:hover { background: #fff; }
        .btn-primary:disabled { opacity: 0.3; cursor: not-allowed; }

        .btn-sm {
          background: #e4e4e4;
          color: #0c0c0c;
          font-family: 'Noto Sans', sans-serif;
          font-weight: 500;
          font-size: 10px;
          padding: 7px 12px;
          border: none;
          border-radius: 0;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .btn-sm:hover { background: #fff; }
        .btn-sm:disabled { opacity: 0.3; cursor: not-allowed; }

        .violation-row {
          transition: background 0.1s;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          user-select: none;
        }
        .violation-row:hover { background: rgba(255,255,255,0.025); }

        .overlay-box {
          cursor: pointer;
          transition: all 0.15s ease;
          position: absolute;
        }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--muted2); }

        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 18;
          vertical-align: middle;
        }

        .score-ring {
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
        }

        .tag {
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-family: 'Noto Sans', sans-serif;
          font-weight: 500;
        }
      `}</style>

      {/* LANDING */}
      {!hasResults && (
        <div className="bauhaus-grid min-h-screen flex flex-col items-center justify-center px-6 py-16 relative">

          {/* Geometric accent — top left corner block */}
          <div className="absolute top-0 left-0 w-32 h-32 border-r border-b border-white/[0.06]" />
          <div className="absolute top-0 left-0 w-8 h-8 bg-emerald-400/20" />
          <div className="absolute bottom-0 right-0 w-32 h-32 border-l border-t border-white/[0.06]" />
          <div className="absolute bottom-0 right-0 w-8 h-8 bg-white/5" />

          <div className="w-full max-w-lg relative">

            {/* Standard marker */}
            <div className="fade-up flex items-center gap-2 mb-8">
              <div className="w-2 h-2 bg-emerald-400 scanning-dot" />
              <span className="tag text-zinc-500">WCAG 2.1 AA — automated audit</span>
            </div>

            {/* Headline */}
            <div className="fade-up-1 mb-10">
              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(2.4rem, 5vw, 3.4rem)", lineHeight: 1.05, color: "#e4e4e4", letterSpacing: "-0.01em" }}>
                Is your site<br />
                <em style={{ color: "#555", fontStyle: "italic" }}>accessible?</em>
              </h1>
              <p className="mt-4 text-zinc-500 text-sm leading-relaxed max-w-sm" style={{ fontFamily: "'Noto Sans', sans-serif" }}>
                Paste any URL and get a clear list of accessibility fixes.
              </p>
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="fade-up-2">
              <div className="flex">
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="Enter URL"
                  className="url-bar url-input flex-1"
                  style={{paddingLeft: "16px"}}
                />
                <button type="submit" disabled={loading || !domain} className="btn-primary">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border border-black/40 border-t-black rounded-full animate-spin" />
                      Scanning
                    </span>
                  ) : "Scan"}
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-4 border border-red-500/30 bg-red-500/5 px-4 py-3">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            {/* Legal cards */}
            <div className="fade-up-2 mt-8 grid grid-cols-2 gap-px bg-[#1e1e1e]" style={{ animationDelay: "0.24s" }}>
              <div className="bg-[#0c0c0c] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 bg-blue-400/20 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-blue-400" />
                  </div>
                  <span className="tag text-zinc-500">EU — EAA 2025</span>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  European Accessibility Act in force since <span className="text-zinc-200">June 2025</span>. All digital products sold in the EU must comply or face fines.
                </p>
              </div>
              <div className="bg-[#0c0c0c] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 bg-red-400/20 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-red-400" />
                  </div>
                  <span className="tag text-zinc-500">US — ADA Title III</span>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  US courts consistently rule websites must comply with ADA. <span className="text-zinc-200">Thousands of lawsuits</span> filed annually.
                </p>
              </div>
            </div>

            <p className="mt-4 text-zinc-700 text-xs text-center" style={{ fontFamily: "'Noto Sans', sans-serif" }}>
              Both laws reference <span className="text-zinc-500">WCAG 2.1 AA</span> as the compliance standard.
            </p>

            {/* Footer */}
            <div className="mt-10 flex justify-center">
              <p className="text-zinc-700 text-xs">
                Please double check results as I am working on improving this.{" "}
                <a href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300 transition">
                  Please let me know if you have any feedback.
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS — split layout */}
      {hasResults && (
        <div className="flex h-screen overflow-hidden fade-in">

          {/* LEFT PANEL */}
          <div className="w-[300px] flex-shrink-0 bg-[#0e0e0e] border-r border-[#1e1e1e] flex flex-col h-full">

            {/* Panel top */}
            <div className="border-b border-[#1e1e1e]">

              {/* Rescan */}
              <div className="p-3 border-b border-[#1a1a1a]">
                <form onSubmit={handleSubmit} className="flex gap-1.5">
                  <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="Enter URL"
                  className="url-bar-sm url-input-sm"
                  style={{paddingLeft: "10px"}}
                />
                  <button type="submit" disabled={loading} className="btn-sm">
                    {loading
                      ? <span className="w-3 h-3 border border-black/40 border-t-black rounded-full animate-spin block" />
                      : "Scan"
                    }
                  </button>
                </form>
              </div>

              {/* Score block */}
              <div className="p-4 flex items-center gap-4">
                {/* Score ring */}
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="#1e1e1e" strokeWidth="3" />
                    <circle
                      cx="28" cy="28" r="22"
                      fill="none"
                      stroke={score > 60 ? "#34d399" : score > 30 ? "#fbbf24" : "#f87171"}
                      strokeWidth="3"
                      strokeDasharray={`${(score / 100) * 138.2} 138.2`}
                      className="score-ring"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium" style={{ fontFamily: "'Noto Sans', sans-serif" }}>
                    {score}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="text-white text-base font-light" style={{ fontFamily: "'DM Serif Display', serif" }}>
                    {total} issues
                  </p>
                  <p className="text-zinc-600 text-xs truncate mt-0.5">{scannedUrl}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <MaterialIcon name="bolt" size={11} className="text-emerald-400" />
                    <span className="text-emerald-400 text-xs">{quickWins} quick wins</span>
                  </div>
                </div>
              </div>

              {/* Standard badge */}
              <div className="px-4 pb-3 flex items-center gap-1.5">
                <MaterialIcon name="verified" size={12} className="text-zinc-600" />
                <span className="tag text-zinc-600">WCAG 2.1 AA</span>
              </div>
            </div>

            {/* Violations */}
            <div className="flex-1 overflow-y-auto">
              {(["Quick win", "Moderate", "Complex"] as const).map((effortLevel) => {
                const group = violations.filter((v) => v.effort === effortLevel);
                if (group.length === 0) return null;
                const config = effortConfig[effortLevel];

                return (
                  <div key={effortLevel}>
                    {/* Group header */}
                    <div className="px-3 py-2 flex items-center justify-between bg-[#0e0e0e] border-b border-[#1a1a1a] sticky top-0 z-10">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 ${config.dot}`} />
                        <span className="tag text-zinc-500">{config.label}</span>
                      </div>
                      <span className={`tag px-1.5 py-0.5 ${config.badge}`}>{group.length}</span>
                    </div>

                    {group.map((v) => {
                      const isActive = activeViolation?.id === v.id;
                      const copyText = `${v.title}\n\nWhy it matters: ${v.why}\n\nHow to fix: ${v.fix}\n\nEffort: ${v.effortTime}`;

                      return (
                        <div
                          key={v.id}
                          className={`violation-row ${isActive ? config.activeBg : ""}`}
                        >
                          {/* Left accent bar */}
                          <div className="flex">
                            <div className={`w-0.5 flex-shrink-0 ${isActive ? config.accentBar : "bg-transparent"}`} />
                            <button
                              onClick={() => setActiveViolation(isActive ? null : v)}
                              className="flex-1 text-left px-3 py-3"
                            >
                              <div className="flex items-start gap-2">
                                <MaterialIcon
                                  name={config.icon}
                                  size={13}
                                  className={isActive ? "text-zinc-300 mt-0.5 flex-shrink-0" : "text-zinc-600 mt-0.5 flex-shrink-0"}
                                />
                                <div className="min-w-0">
                                  <p className={`text-xs leading-snug ${isActive ? "text-white" : "text-zinc-400"}`} style={{ fontFamily: "'Noto Sans', sans-serif" }}>
                                    {v.title}
                                  </p>
                                  <p className="tag text-zinc-700 mt-0.5">{v.category} · {v.nodes} el.</p>
                                </div>
                                <MaterialIcon
                                  name={isActive ? "expand_less" : "expand_more"}
                                  size={14}
                                  className="text-zinc-700 flex-shrink-0 ml-auto"
                                />
                              </div>

                              {/* Expanded */}
                              {isActive && (
                                <div className="mt-3 ml-5 select-text" onClick={(e) => e.stopPropagation()}>
                                  <p className="text-zinc-500 text-xs leading-relaxed mb-3">{v.why}</p>
                                  <div className="border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="tag text-emerald-500">How to fix</span>
                                      <CopyButton text={copyText} />
                                    </div>
                                    <p className="text-zinc-300 text-xs leading-relaxed">{v.fix}</p>
                                  </div>
                                  <p className="tag text-zinc-700 mt-2 flex items-center gap-1">
                                    <MaterialIcon name="schedule" size={11} className="text-zinc-700" />
                                    {v.effortTime}
                                  </p>
                                </div>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Panel footer */}
            <div className="px-4 py-3 border-t border-[#1e1e1e] flex items-center justify-between">
              <span className="tag text-zinc-700">WCAG 2.1 AA</span>
              <a href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/" target="_blank" rel="noopener noreferrer" className="tag text-zinc-600 hover:text-zinc-300 transition flex items-center gap-1">
                <MaterialIcon name="feedback" size={11} className="text-zinc-600" />
                Feedback
              </a>
            </div>
          </div>

          {/* RIGHT — visual */}
          <div className="flex-1 overflow-auto bg-[#0a0a0a] bauhaus-grid">
            <div className="p-6">
              {/* Legend bar */}
              <div className="flex items-center gap-6 mb-4">
                {(["Quick win", "Moderate", "Complex"] as const).map((e) => (
                  <div key={e} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 border"
                      style={{ background: effortConfig[e].overlay, borderColor: effortConfig[e].stroke }}
                    />
                    <span className="tag text-zinc-600">{effortConfig[e].label}</span>
                  </div>
                ))}
                <span className="tag text-zinc-700 ml-auto flex items-center gap-1">
                  <MaterialIcon name="touch_app" size={11} className="text-zinc-700" />
                  Click to focus
                </span>
              </div>

              {/* Screenshot */}
              <div
                ref={imageRef}
                className="relative w-full border border-[#222] shadow-2xl"
                style={{ aspectRatio: `${pageWidth} / ${pageHeight}` }}
                onClick={() => setActiveViolation(null)}
              >
                <img
                  src={`data:image/jpeg;base64,${screenshot}`}
                  alt="Page screenshot"
                  className="w-full h-full object-cover object-top"
                />

                {violations.map((violation) =>
                  (violation.boxes ?? []).map((box, boxIdx) => {
                    const config = effortConfig[violation.effort];
                    const isActive = activeViolation?.id === violation.id;
                    const isAnyActive = activeViolation !== null;

                    return (
                      <div
                        key={`${violation.id}-${boxIdx}`}
                        className="overlay-box"
                        style={{
                          left: `${(box.x / pageWidth) * 100}%`,
                          top: `${(box.y / pageHeight) * 100}%`,
                          width: `${(box.width / pageWidth) * 100}%`,
                          height: `${(box.height / pageHeight) * 100}%`,
                          background: isActive ? config.overlay : isAnyActive ? "rgba(255,255,255,0.02)" : config.overlay,
                          border: `1px solid ${isActive ? config.stroke : isAnyActive ? "rgba(255,255,255,0.08)" : config.stroke}`,
                          opacity: isAnyActive && !isActive ? 0.25 : 1,
                          boxShadow: isActive ? `0 0 0 1px ${config.stroke}60, inset 0 0 0 1px ${config.stroke}30` : "none",
                          transition: "all 0.2s ease",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveViolation(isActive ? null : violation);
                        }}
                      />
                    );
                  })
                )}
              </div>

              <p className="tag text-zinc-700 mt-3 text-center">
                Please double check results as this tool is a work in progress.{" "}
                <a href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/" target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-zinc-300 transition">
                  Please let me know if you have any feedback.
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
