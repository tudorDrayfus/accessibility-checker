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

const impactDot: Record<string, string> = {
  critical: "bg-red-500",
  serious: "bg-orange-400",
  moderate: "bg-yellow-400",
  minor: "bg-blue-400",
};

const effortConfig = {
  "Quick win": {
    icon: "⚡",
    label: "Quick Wins",
    sublabel: "Fix these today",
    border: "border-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-400",
    overlay: "rgba(52, 211, 153, 0.15)",
    stroke: "#34d399",
  },
  Moderate: {
    icon: "🔧",
    label: "Moderate Effort",
    sublabel: "Plan for next sprint",
    border: "border-yellow-500/20",
    badge: "bg-yellow-500/10 text-yellow-400",
    overlay: "rgba(251, 191, 36, 0.15)",
    stroke: "#fbbf24",
  },
  Complex: {
    icon: "🏗",
    label: "Complex Fixes",
    sublabel: "Requires design + dev",
    border: "border-red-500/20",
    badge: "bg-red-500/10 text-red-400",
    overlay: "rgba(248, 113, 113, 0.15)",
    stroke: "#f87171",
  },
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [violations, setViolations] = useState<Violation[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "visual">("list");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(1440);
  const [pageHeight, setPageHeight] = useState(900);
  const [activeBox, setActiveBox] = useState<{ violation: Violation; box: Box } | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setViolations([]);
    setTotal(null);
    setError(null);
    setScannedUrl(null);
    setExpanded(null);
    setScreenshot(null);
    setActiveBox(null);
    setView("list");

    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (data.error) {
      setError(data.error);
    } else {
      setViolations(data.violations ?? []);
      setTotal(data.total ?? 0);
      setScannedUrl(url);
      setScreenshot(data.screenshot ?? null);
      setPageWidth(data.pageWidth ?? 1440);
      setPageHeight(data.pageHeight ?? 900);
    }

    setLoading(false);
  }

  const quickWins = violations.filter((v) => v.effort === "Quick win").length;

  // Calculate scale factor for overlays
  const getScale = () => {
    if (!imageRef.current) return 1;
    return imageRef.current.offsetWidth / pageWidth;
  };

  return (
    <main
      className="min-h-screen bg-[#0a0a0a] px-4 py-16"
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
        .fade-up { animation: fadeUp 0.5s ease both; }
        .fade-up-1 { animation: fadeUp 0.5s 0.1s ease both; }
        .scanning-dot { animation: pulse-dot 1s infinite; }
        .overlay-box { cursor: pointer; transition: all 0.15s ease; }
        .overlay-box:hover { filter: brightness(1.3); }
      `}</style>

      <div className="w-full max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-12 fade-up">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 scanning-dot" />
            <span className="text-xs text-zinc-400 tracking-wide">Free accessibility audit</span>
          </div>
          <h1
            className="text-white text-5xl mb-3 leading-tight"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Is your site<br />
            <em className="text-zinc-500">accessible?</em>
          </h1>
          <p className="text-zinc-500 text-base leading-relaxed max-w-md">
            Paste any URL and get a plain-English report grouped by effort —
            no WCAG jargon, just clear fixes.
          </p>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mb-10 fade-up-1">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourwebsite.com"
              className="flex-1 bg-white/5 text-white border border-white/10 rounded-xl px-5 py-4 text-sm outline-none focus:border-white/30 transition placeholder-zinc-600"
            />
            <button
              type="submit"
              disabled={loading || !url}
              className="bg-white text-black font-semibold px-7 py-4 rounded-xl hover:bg-zinc-100 transition disabled:opacity-40 text-sm whitespace-nowrap"
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

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 mb-6 fade-up">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Summary + view toggle */}
        {total !== null && scannedUrl && (
          <div className="fade-up mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-5 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className="text-white text-3xl font-light mb-1"
                    style={{ fontFamily: "'DM Serif Display', serif" }}
                  >
                    {total} {total === 1 ? "issue" : "issues"} found
                  </p>
                  <p className="text-zinc-500 text-sm truncate max-w-xs">{scannedUrl}</p>
                </div>
                {quickWins > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-right">
                    <p className="text-emerald-400 text-xl font-semibold">{quickWins}</p>
                    <p className="text-emerald-600 text-xs">quick wins</p>
                  </div>
                )}
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-xs text-zinc-600 mb-1.5">
                  <span>Accessibility score</span>
                  <span>{Math.max(0, 100 - total * 5)}/100</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.max(0, 100 - total * 5)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* View toggle */}
            {screenshot && (
              <div className="flex gap-2">
                <button
                  onClick={() => setView("list")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                    view === "list"
                      ? "bg-white text-black"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  ☰ List view
                </button>
                <button
                  onClick={() => setView("visual")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                    view === "visual"
                      ? "bg-white text-black"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  ◻ Visual view
                </button>
              </div>
            )}
          </div>
        )}

        {/* VISUAL VIEW */}
        {view === "visual" && screenshot && (
          <div className="fade-up mb-10">
            {/* Legend */}
            <div className="flex gap-4 mb-3">
              {(["Quick win", "Moderate", "Complex"] as const).map((e) => (
                <div key={e} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm border"
                    style={{ background: effortConfig[e].overlay, borderColor: effortConfig[e].stroke }}
                  />
                  <span className="text-zinc-500 text-xs">{effortConfig[e].label}</span>
                </div>
              ))}
            </div>

            {/* Screenshot with overlays */}
            <div
              ref={imageRef}
              className="relative w-full rounded-xl overflow-hidden border border-white/10"
              style={{ aspectRatio: `${pageWidth} / ${pageHeight}` }}
              onClick={() => setActiveBox(null)}
            >
              <img
                src={`data:image/jpeg;base64,${screenshot}`}
                alt="Page screenshot"
                className="w-full h-full object-cover object-top"
              />

              {/* Overlay boxes */}
              {violations.map((violation) =>
                (violation.boxes ?? []).map((box, boxIdx) => {
                  const config = effortConfig[violation.effort];
                  const scale = getScale();
                  const isActive =
                    activeBox?.violation.id === violation.id &&
                    activeBox?.box === box;

                  return (
                    <div
                      key={`${violation.id}-${boxIdx}`}
                      className="overlay-box absolute"
                      style={{
                        left: `${(box.x / pageWidth) * 100}%`,
                        top: `${(box.y / pageHeight) * 100}%`,
                        width: `${(box.width / pageWidth) * 100}%`,
                        height: `${(box.height / pageHeight) * 100}%`,
                        background: config.overlay,
                        border: `2px solid ${config.stroke}`,
                        borderRadius: "2px",
                        boxShadow: isActive ? `0 0 0 3px ${config.stroke}` : "none",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveBox(isActive ? null : { violation, box });
                      }}
                    />
                  );
                })
              )}

              {/* Tooltip */}
              {activeBox && (
                <div
                  className="absolute z-50 w-64 bg-zinc-900 border border-white/10 rounded-xl p-4 shadow-2xl"
                  style={{
                    left: `${Math.min((activeBox.box.x / pageWidth) * 100, 60)}%`,
                    top: `${Math.min((activeBox.box.y / pageHeight) * 100 + (activeBox.box.height / pageHeight) * 100 + 1, 80)}%`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-500 uppercase tracking-wide">
                      {activeBox.violation.category}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${effortConfig[activeBox.violation.effort].badge}`}>
                      {activeBox.violation.effort}
                    </span>
                  </div>
                  <p className="text-white text-sm font-medium mb-1">
                    {activeBox.violation.title}
                  </p>
                  <p className="text-zinc-400 text-xs mb-3">
                    {activeBox.violation.why}
                  </p>
                  <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                    <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">Fix</p>
                    <p className="text-zinc-300 text-xs leading-relaxed">{activeBox.violation.fix}</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-zinc-600 text-xs mt-2 text-center">
              Click any highlighted area to see the issue and fix
            </p>
          </div>
        )}

        {/* LIST VIEW */}
        {view === "list" && (
          <>
            {(["Quick win", "Moderate", "Complex"] as const).map((effortLevel, groupIdx) => {
              const group = violations.filter((v) => v.effort === effortLevel);
              if (group.length === 0) return null;
              const config = effortConfig[effortLevel];

              return (
                <div
                  key={effortLevel}
                  className="mb-8 fade-up"
                  style={{ animationDelay: `${groupIdx * 0.1}s` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{config.icon}</span>
                      <span className="text-white text-sm font-medium">{config.label}</span>
                      <span className="text-zinc-600 text-xs">{config.sublabel}</span>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${config.badge}`}>
                      {group.length}
                    </span>
                  </div>

                  {group.map((v, i) => (
                    <div
                      key={v.id}
                      className={`border rounded-xl mb-2 overflow-hidden transition-all duration-200 ${config.border} bg-white/[0.02] hover:bg-white/[0.04]`}
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      <button
                        onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                        className="w-full text-left px-5 py-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${impactDot[v.impact ?? "minor"] ?? "bg-zinc-600"}`} />
                            <span className="text-white text-sm font-medium">{v.title}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-zinc-600 text-xs hidden sm:block">{v.effortTime}</span>
                            <span className="text-zinc-600 text-xs">{v.nodes} element{v.nodes !== 1 ? "s" : ""}</span>
                            <span className="text-zinc-600 text-xs">{expanded === v.id ? "▲" : "▼"}</span>
                          </div>
                        </div>
                        <p className="text-zinc-500 text-xs mt-1 ml-5">{v.category}</p>
                      </button>

                      {expanded === v.id && (
                        <div className="px-5 pb-5 border-t border-white/5">
                          <div className="mt-4 mb-3">
                            <p className="text-zinc-400 text-sm leading-relaxed">{v.why}</p>
                          </div>
                          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-4 py-3">
                            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                              How to fix
                            </p>
                            <p className="text-zinc-300 text-sm leading-relaxed">{v.fix}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}

        {/* Empty state */}
        {total === 0 && (
          <div className="text-center py-16 fade-up">
            <p className="text-5xl mb-4">🎉</p>
            <p className="text-white text-xl font-medium mb-2">No issues found</p>
            <p className="text-zinc-500 text-sm">This page passed all automated accessibility checks.</p>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="w-full max-w-2xl mx-auto mt-16 pb-8 flex flex-col items-center gap-2">
        <p className="text-zinc-700 text-xs">
          Please double check results. I am working on improving this, but if results are terrible{" "}
          <a
            href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition"
          >
            let me know
          </a>
          .
        </p>
        <p className="text-zinc-700 text-xs">
          Made by{" "}
          <a
            href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition"
          >
            Tudor Teisanu
          </a>
        </p>
      </div>

    </main>
  );
}
