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
    icon: "⚡",
    label: "Quick Wins",
    border: "border-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
    overlay: "rgba(52, 211, 153, 0.2)",
    stroke: "#34d399",
    activeBg: "bg-emerald-500/10",
  },
  Moderate: {
    icon: "🔧",
    label: "Moderate",
    border: "border-yellow-500/20",
    badge: "bg-yellow-500/10 text-yellow-400",
    dot: "bg-yellow-400",
    overlay: "rgba(251, 191, 36, 0.2)",
    stroke: "#fbbf24",
    activeBg: "bg-yellow-500/10",
  },
  Complex: {
    icon: "🏗",
    label: "Complex",
    border: "border-red-500/20",
    badge: "bg-red-500/10 text-red-400",
    dot: "bg-red-400",
    overlay: "rgba(248, 113, 113, 0.2)",
    stroke: "#f87171",
    activeBg: "bg-red-500/10",
  },
};

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

  return (
    <main
      className="min-h-screen bg-[#0a0a0a]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .fade-up { animation: fadeUp 0.5s ease both; }
        .fade-in { animation: fadeIn 0.4s ease both; }
        .scanning-dot { animation: pulse-dot 1s infinite; }
        .overlay-box { cursor: pointer; transition: all 0.2s ease; }
        .violation-row { transition: background 0.15s ease; }
        .violation-row:hover { background: rgba(255,255,255,0.04); }
        .violation-row.active { background: rgba(255,255,255,0.06); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
        .url-input-wrapper {
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .url-input-wrapper:focus-within {
          border-color: rgba(255,255,255,0.3);
        }
        .url-prefix {
          padding: 16px 0 16px 20px;
          color: #3f3f46;
          font-size: 14px;
          white-space: nowrap;
          user-select: none;
          flex-shrink: 0;
        }
        .url-input {
          flex: 1;
          background: transparent;
          color: white;
          font-size: 14px;
          padding: 16px 8px;
          outline: none;
          border: none;
          min-width: 0;
        }
        .url-input::placeholder { color: #52525b; }
        .url-input-sm-wrapper {
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          overflow: hidden;
          transition: border-color 0.2s;
          flex: 1;
          min-width: 0;
        }
        .url-input-sm-wrapper:focus-within {
          border-color: rgba(255,255,255,0.3);
        }
        .url-prefix-sm {
          padding: 8px 0 8px 12px;
          color: #3f3f46;
          font-size: 11px;
          white-space: nowrap;
          user-select: none;
          flex-shrink: 0;
        }
        .url-input-sm {
          flex: 1;
          background: transparent;
          color: white;
          font-size: 11px;
          padding: 8px 6px;
          outline: none;
          border: none;
          min-width: 0;
        }
        .url-input-sm::placeholder { color: #52525b; }
      `}</style>

      {/* LANDING STATE */}
      {!hasResults && (
        <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
          <div className="w-full max-w-xl">
            <div className="mb-10 fade-up">
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 scanning-dot" />
                <span className="text-xs text-zinc-400 tracking-wide">Checks against WCAG 2.1 AA</span>
              </div>
              <h1
                className="text-white text-5xl mb-3 leading-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Is your site<br />
                <em className="text-zinc-500">accessible?</em>
              </h1>
              <p className="text-zinc-500 text-base leading-relaxed max-w-md">
                Paste any URL and get a clear list of accessibility fixes.
              </p>
            </div>

            {/* URL input */}
            <form onSubmit={handleSubmit} className="fade-up" style={{ animationDelay: "0.1s" }}>
              <div className="flex gap-2">
                <div className="url-input-wrapper flex-1">
                  <span className="url-prefix">https://www.</span>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="yourwebsite.com"
                    className="url-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !domain}
                  className="bg-white text-black font-semibold px-7 py-4 rounded-xl hover:bg-zinc-100 transition disabled:opacity-40 text-sm whitespace-nowrap flex-shrink-0"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Scanning
                    </span>
                  ) : "Scan site"}
                </button>
              </div>
            </form>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 mt-4 fade-up">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Legal context */}
            <div className="mt-10 fade-up" style={{ animationDelay: "0.2s" }}>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1.5">🇪🇺 European Accessibility Act</p>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    In force since <span className="text-zinc-300">June 2025</span>. All digital products and services sold in the EU must meet accessibility standards or face fines.
                  </p>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1.5">🇺🇸 ADA Title III</p>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    US courts consistently rule that websites must be accessible under the ADA. <span className="text-zinc-300">Thousands of lawsuits</span> filed annually against non-compliant sites.
                  </p>
                </div>
              </div>
              <p className="text-zinc-700 text-xs text-center mt-3">
                This tool checks against <span className="text-zinc-500">WCAG 2.1 AA</span> — the standard referenced by both laws.
              </p>
            </div>

            {/* Footer */}
            <div className="mt-10 flex flex-col items-center gap-1.5">
              <p className="text-zinc-700 text-xs">
                Please double check results as I am working on improving this.{" "}
                <a href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition">
                  Please let me know if you have any feedback.
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS STATE — split layout */}
      {hasResults && (
        <div className="flex h-screen overflow-hidden fade-in">

          {/* LEFT PANEL */}
          <div className="w-80 flex-shrink-0 bg-[#111] border-r border-white/5 flex flex-col h-full">

            {/* Panel header */}
            <div className="px-4 py-4 border-b border-white/5">
              {/* Rescan input */}
              <form onSubmit={handleSubmit} className="flex gap-1.5 mb-4">
                <div className="url-input-sm-wrapper">
                  <span className="url-prefix-sm">https://www.</span>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="yourwebsite.com"
                    className="url-input-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-white text-black font-semibold px-3 py-2 rounded-lg hover:bg-zinc-100 transition disabled:opacity-40 text-xs whitespace-nowrap flex-shrink-0"
                >
                  {loading ? (
                    <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin block" />
                  ) : "Scan"}
                </button>
              </form>

              {/* Score summary */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white text-lg font-light" style={{ fontFamily: "'DM Serif Display', serif" }}>
                    {total} issues
                  </p>
                  <p className="text-zinc-600 text-xs truncate max-w-[180px]">{scannedUrl}</p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 text-sm font-semibold">{quickWins}</p>
                  <p className="text-zinc-600 text-xs">quick wins</p>
                </div>
              </div>

              {/* Score bar */}
              <div>
                <div className="flex justify-between text-xs text-zinc-600 mb-1">
                  <span>WCAG 2.1 AA score</span>
                  <span>{Math.max(0, 100 - (total ?? 0) * 5)}/100</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${Math.max(0, 100 - (total ?? 0) * 5)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Violations list */}
            <div className="flex-1 overflow-y-auto">
              {(["Quick win", "Moderate", "Complex"] as const).map((effortLevel) => {
                const group = violations.filter((v) => v.effort === effortLevel);
                if (group.length === 0) return null;
                const config = effortConfig[effortLevel];

                return (
                  <div key={effortLevel}>
                    <div className="px-4 py-2 flex items-center justify-between sticky top-0 bg-[#111] border-b border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{config.icon}</span>
                        <span className="text-zinc-500 text-xs font-medium">{config.label}</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${config.badge}`}>
                        {group.length}
                      </span>
                    </div>

                    {group.map((v) => {
                      const isActive = activeViolation?.id === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setActiveViolation(isActive ? null : v)}
                          className={`violation-row w-full text-left px-4 py-3 border-b border-white/[0.03] ${isActive ? config.activeBg + " active" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${config.dot}`} />
                            <div className="min-w-0">
                              <p className={`text-xs font-medium leading-snug ${isActive ? "text-white" : "text-zinc-300"}`}>
                                {v.title}
                              </p>
                              <p className="text-zinc-600 text-xs mt-0.5">{v.category} · {v.nodes} element{v.nodes !== 1 ? "s" : ""}</p>
                            </div>
                          </div>

                          {isActive && (
                            <div className="mt-3 ml-3.5">
                              <p className="text-zinc-400 text-xs leading-relaxed mb-2">{v.why}</p>
                              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">Fix</p>
                                <p className="text-zinc-300 text-xs leading-relaxed">{v.fix}</p>
                              </div>
                              <p className="text-zinc-600 text-xs mt-2">{v.effortTime}</p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/5">
              <p className="text-zinc-700 text-xs">
                Checks against WCAG 2.1 AA ·{" "}
                <a href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition">
                  Feedback
                </a>
              </p>
            </div>
          </div>

          {/* RIGHT — screenshot */}
          <div className="flex-1 overflow-auto bg-[#0d0d0d] p-6">
            <div
              ref={imageRef}
              className="relative w-full rounded-xl overflow-hidden border border-white/10 shadow-2xl"
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
                      className="overlay-box absolute"
                      style={{
                        left: `${(box.x / pageWidth) * 100}%`,
                        top: `${(box.y / pageHeight) * 100}%`,
                        width: `${(box.width / pageWidth) * 100}%`,
                        height: `${(box.height / pageHeight) * 100}%`,
                        background: isActive ? config.overlay : isAnyActive ? "rgba(255,255,255,0.03)" : config.overlay,
                        border: `2px solid ${isActive ? config.stroke : isAnyActive ? "rgba(255,255,255,0.1)" : config.stroke}`,
                        borderRadius: "2px",
                        opacity: isAnyActive && !isActive ? 0.3 : 1,
                        boxShadow: isActive ? `0 0 0 2px ${config.stroke}40` : "none",
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

            {/* Legend */}
            <div className="flex gap-5 mt-4 px-1">
              {(["Quick win", "Moderate", "Complex"] as const).map((e) => (
                <div key={e} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm border"
                    style={{ background: effortConfig[e].overlay, borderColor: effortConfig[e].stroke }}
                  />
                  <span className="text-zinc-600 text-xs">{effortConfig[e].label}</span>
                </div>
              ))}
              <span className="text-zinc-700 text-xs ml-auto">Click any highlight or list item to focus</span>
            </div>
          </div>

        </div>
      )}
    </main>
  );
}
