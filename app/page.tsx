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
  wcagUrl: string;
};

type NumberedViolation = Violation & { num: number };

const effortConfig = {
  "Quick win": {
    label: "Quick Wins",
    sublabel: "Fix these today",
    badge: "bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
    overlay: "rgba(52, 211, 153, 0.15)",
    stroke: "#34d399",
    activeBg: "bg-emerald-500/10",
    accentBar: "bg-emerald-400",
    numBg: "bg-emerald-500/20 text-emerald-300",
  },
  Moderate: {
    label: "Moderate Effort",
    sublabel: "Plan for next sprint",
    badge: "bg-yellow-500/10 text-yellow-400",
    dot: "bg-yellow-400",
    overlay: "rgba(251, 191, 36, 0.15)",
    stroke: "#fbbf24",
    activeBg: "bg-yellow-500/10",
    accentBar: "bg-yellow-400",
    numBg: "bg-yellow-500/20 text-yellow-300",
  },
  Complex: {
    label: "Complex Fixes",
    sublabel: "Requires design + dev",
    badge: "bg-red-500/10 text-red-400",
    dot: "bg-red-400",
    overlay: "rgba(248, 113, 113, 0.15)",
    stroke: "#f87171",
    activeBg: "bg-red-500/10",
    accentBar: "bg-red-400",
    numBg: "bg-red-500/20 text-red-300",
  },
};

const ICONS: Record<string, string> = {
  chevron_right: "›",
  content_copy: "⎘",
  check: "✓",
  schedule: "◷",
  verified: "✓",
  feedback: "✉",
  touch_app: "◉",
  visibility: "◎",
  visibility_off: "◌",
};

function MatIcon({ name, size = 16, className = "", style = {} }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`select-none leading-none ${className}`} style={{ fontSize: size, lineHeight: 1, ...style }} aria-hidden="true">
      {ICONS[name] ?? ""}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 text-zinc-400 hover:text-white transition text-xs"
    >
      <MatIcon name={copied ? "check" : "content_copy"} size={13} />
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
  const [activeViolation, setActiveViolation] = useState<NumberedViolation | null>(null);
  const [hiddenEfforts, setHiddenEfforts] = useState<Set<string>>(new Set());
  const imageRef = useRef<HTMLDivElement>(null);

  function getFullUrl(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    return `https://${trimmed}`;
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
    setHiddenEfforts(new Set());

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

  function toggleEffort(effort: string) {
    setHiddenEfforts((prev) => {
      const next = new Set(prev);
      if (next.has(effort)) next.delete(effort);
      else next.add(effort);
      return next;
    });
  }

  const hasResults = total !== null && screenshot;
  const score = Math.max(0, 100 - (total ?? 0) * 5);
  const numberedViolations: NumberedViolation[] = violations.map((v, i) => ({ ...v, num: i + 1 }));

  return (
    <main className="min-h-screen bg-[#0a0a0a]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
        .fade-up   { animation: fadeUp 0.45s ease both; }
        .fade-up-1 { animation: fadeUp 0.45s 0.09s ease both; }
        .fade-up-2 { animation: fadeUp 0.45s 0.18s ease both; }
        .fade-in   { animation: fadeIn 0.3s ease both; }
        .scanning-dot { animation: pulse-dot 1.2s infinite; }
        .violation-row { transition: background 0.12s; }
        .violation-row:hover { background: rgba(255,255,255,0.035); }
        .overlay-box { cursor:pointer; transition:all 0.18s ease; position:absolute; }
        .legend-pill { transition: opacity 0.15s, filter 0.15s; cursor: pointer; user-select: none; }
        .legend-pill.off { opacity: 0.35; filter: saturate(0); }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#2a2a2a; }
        .chevron { transition: transform 0.2s ease; }
        .chevron.open { transform: rotate(90deg); }
      `}</style>

      {/* LANDING */}
      {!hasResults && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-xl">
            <div className="mb-12 fade-up">
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 scanning-dot" />
                <span className="text-xs text-zinc-300 tracking-wide">WCAG 2.1 AA — automated audit</span>
              </div>
              <h1 className="text-white text-5xl mb-3 leading-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>
                Is your site<br />
                <em className="text-zinc-400" style={{ fontStyle: "italic" }}>accessible?</em>
              </h1>
              <p className="text-zinc-300 text-base leading-relaxed max-w-md">
                Paste any URL and get a clear list of accessibility fixes.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mb-10 fade-up-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="Enter URL"
                  className="flex-1 bg-white/5 text-white border border-white/15 rounded-xl px-5 py-4 text-sm outline-none focus:border-white/40 transition placeholder-zinc-500"
                />
                <button
                  type="submit"
                  disabled={loading || !domain}
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

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 mb-6 fade-up">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 fade-up-2">
              <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-zinc-200 text-xs font-semibold uppercase tracking-wider">EU — EAA 2025</span>
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed">
                  European Accessibility Act in force since <span className="text-white font-medium">June 2025</span>. All digital products sold in the EU must comply or face fines.
                </p>
              </div>
              <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="text-zinc-200 text-xs font-semibold uppercase tracking-wider">US — ADA Title III</span>
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed">
                  US courts consistently rule websites must comply with ADA. <span className="text-white font-medium">Thousands of lawsuits</span> filed annually.
                </p>
              </div>
            </div>

            <p className="mt-4 text-zinc-400 text-xs text-center fade-up-2">
              Both laws reference <span className="text-zinc-200">WCAG 2.1 AA</span> as the compliance standard.
            </p>

            <div className="mt-10 flex justify-center fade-up-2">
              <p className="text-zinc-400 text-xs text-center">
                Please double check results as I am working on improving this.{" "}
                <a href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/" target="_blank" rel="noopener noreferrer" className="text-zinc-200 underline hover:text-white transition">
                  Please let me know if you have any feedback.
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS */}
      {hasResults && (
        <div className="flex h-screen overflow-hidden fade-in">

          {/* LEFT PANEL */}
          <div className="w-[300px] flex-shrink-0 bg-[#111] border-r border-white/8 flex flex-col h-full">

            {/* Rescan */}
            <div className="px-3 py-3 border-b border-white/8">
              <form onSubmit={handleSubmit} className="flex gap-1.5">
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="Enter URL"
                  className="flex-1 bg-white/5 text-white border border-white/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-white/40 transition placeholder-zinc-500 min-w-0"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-white text-black font-semibold px-3 py-2 rounded-lg hover:bg-zinc-100 transition disabled:opacity-40 text-xs whitespace-nowrap flex-shrink-0"
                >
                  {loading
                    ? <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin block" />
                    : "Scan"
                  }
                </button>
              </form>
            </div>

            {/* Summary — issues + dial only */}
            <div className="px-4 py-4 border-b border-white/8 flex items-center justify-between">
              <div>
                <p className="text-white text-xl font-light" style={{ fontFamily: "'DM Serif Display', serif" }}>
                  {total} issues
                </p>
                <p className="text-zinc-400 text-xs truncate max-w-[170px] mt-0.5">{scannedUrl}</p>
              </div>
              <div className="relative w-12 h-12 flex-shrink-0">
                <svg width="48" height="48" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="19" fill="none" stroke="#222" strokeWidth="3" />
                  <circle
                    cx="24" cy="24" r="19"
                    fill="none"
                    stroke={score > 60 ? "#34d399" : score > 30 ? "#fbbf24" : "#f87171"}
                    strokeWidth="3"
                    strokeDasharray={`${(score / 100) * 119.4} 119.4`}
                    style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium">
                  {score}
                </span>
              </div>
            </div>

            {/* Violations list */}
            <div className="flex-1 overflow-y-auto">
              {(["Quick win", "Moderate", "Complex"] as const).map((effortLevel) => {
                const group = numberedViolations.filter((v) => v.effort === effortLevel);
                if (group.length === 0) return null;
                const config = effortConfig[effortLevel];

                return (
                  <div key={effortLevel}>
                    <div className="px-4 py-2 flex items-center justify-between sticky top-0 bg-[#111] border-b border-white/5 z-10">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-200 text-xs font-medium">{config.label}</span>
                        <span className="text-zinc-500 text-xs">{config.sublabel}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
                        {group.length}
                      </span>
                    </div>

                    {group.map((v) => {
                      const isActive = activeViolation?.id === v.id;
                      const copyText = `${v.title}\n\nWhy it matters:\n${v.why}\n\nHow to fix:\n${v.fix}\n\nEstimated effort: ${v.effortTime}\nWCAG reference: ${v.wcagUrl}`;

                      return (
                        <div
                          key={v.id}
                          className={`violation-row border-b border-white/5 ${isActive ? config.activeBg : ""}`}
                        >
                          <div className="flex">
                            <div className={`w-0.5 flex-shrink-0 ${isActive ? config.accentBar : "bg-transparent"}`} />
                            <button
                              onClick={() => setActiveViolation(isActive ? null : v)}
                              className="flex-1 text-left px-3 py-3"
                            >
                              <div className="flex items-start gap-2">
                                <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5 ${config.numBg}`}>
                                  {v.num}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-xs font-medium leading-snug ${isActive ? "text-white" : "text-zinc-200"}`}>
                                    {v.title}
                                  </p>
                                  <p className="text-zinc-500 text-xs mt-0.5">
                                    {v.category}{v.nodes > 1 ? ` · ${v.nodes} elements` : ""}
                                  </p>
                                </div>
                                <MatIcon
                                  name="chevron_right"
                                  size={15}
                                  className={`text-zinc-500 flex-shrink-0 chevron ${isActive ? "open" : ""}`}
                                />
                              </div>

                              {isActive && (
                                <div className="mt-3 ml-6 select-text" onClick={(e) => e.stopPropagation()}>
                                  <p className="text-zinc-300 text-xs leading-relaxed mb-3">{v.why}</p>
                                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">How to fix</span>
                                      <CopyButton text={copyText} />
                                    </div>
                                    <p className="text-zinc-200 text-xs leading-relaxed">{v.fix}</p>
                                  </div>
                                  <div className="flex items-center justify-between mt-2">
                                    <p className="text-zinc-400 text-xs">
                                      Effort: {v.effortTime}
                                    </p>
                                    <a
                                      href={v.wcagUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-zinc-300 hover:text-white transition text-xs underline underline-offset-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      WCAG guideline
                                    </a>
                                  </div>
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
            <div className="px-4 py-3 border-t border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <MatIcon name="verified" size={12} className="text-zinc-400" />
                <span className="text-zinc-400 text-xs">WCAG 2.1 AA</span>
              </div>
              <a
                href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 hover:text-white transition text-xs flex items-center gap-1"
              >
                <MatIcon name="feedback" size={12} className="text-zinc-400" />
                Feedback
              </a>
            </div>
          </div>

          {/* RIGHT — visual */}
          <div className="flex-1 overflow-auto bg-[#0d0d0d] p-6">

            {/* Legend with toggle */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {(["Quick win", "Moderate", "Complex"] as const).map((e) => {
                const config = effortConfig[e];
                const isHidden = hiddenEfforts.has(e);
                const count = numberedViolations.filter((v) => v.effort === e).length;
                if (count === 0) return null;
                return (
                  <button
                    key={e}
                    onClick={() => toggleEffort(e)}
                    className={`legend-pill flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
                      isHidden
                        ? "border-white/5 bg-white/2"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-sm border flex-shrink-0"
                      style={{
                        background: isHidden ? "transparent" : config.overlay,
                        borderColor: isHidden ? "#333" : config.stroke,
                      }}
                    />
                    <span className={`text-xs transition ${isHidden ? "text-zinc-600" : "text-zinc-300"}`}>
                      {config.label}
                    </span>
                    <span className={`text-xs font-medium transition ${isHidden ? "text-zinc-700" : "text-zinc-400"}`}>
                      {count}
                    </span>
                    <MatIcon
                      name={isHidden ? "visibility_off" : "visibility"}
                      size={12}
                      className={isHidden ? "text-zinc-700" : "text-zinc-500"}
                    />
                  </button>
                );
              })}
              <span className="text-zinc-500 text-xs ml-auto flex items-center gap-1">
                <MatIcon name="touch_app" size={12} className="text-zinc-600" />
                Click highlights or list items to focus
              </span>
            </div>

            {/* Screenshot */}
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

              {numberedViolations.map((violation) => {
                if (hiddenEfforts.has(violation.effort)) return null;
                const config = effortConfig[violation.effort];
                const isActive = activeViolation?.id === violation.id;
                const isAnyActive = activeViolation !== null;

                return (violation.boxes ?? []).map((box, boxIdx) => (
                  <div
                    key={`${violation.id}-${boxIdx}`}
                    className="overlay-box"
                    style={{
                      left: `${(box.x / pageWidth) * 100}%`,
                      top: `${(box.y / pageHeight) * 100}%`,
                      width: `${(box.width / pageWidth) * 100}%`,
                      height: `${(box.height / pageHeight) * 100}%`,
                      background: isActive ? config.overlay : isAnyActive ? "rgba(255,255,255,0.02)" : config.overlay,
                      border: `2px solid ${isActive ? config.stroke : isAnyActive ? "rgba(255,255,255,0.08)" : config.stroke}`,
                      borderRadius: "2px",
                      opacity: isAnyActive && !isActive ? 0.25 : 1,
                      boxShadow: isActive ? `0 0 0 2px ${config.stroke}50` : "none",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveViolation(isActive ? null : violation);
                    }}
                  >
                    {/* Number badge on overlay */}
                    {boxIdx === 0 && (
                      <span
                        className="absolute top-0 left-0 flex items-center justify-center text-[8px] font-bold leading-none"
                        style={{
                          width: 14,
                          height: 14,
                          background: config.stroke,
                          color: "#0a0a0a",
                          borderRadius: "50%",
                          transform: "translate(-50%, -50%)",
                          zIndex: 10,
                        }}
                      >
                        {violation.num}
                      </span>
                    )}
                  </div>
                ));
              })}
            </div>

            <p className="text-zinc-400 text-xs mt-3 text-center">
              Please double check results as I am working on improving this.{" "}
              <a href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/" target="_blank" rel="noopener noreferrer" className="text-zinc-200 underline underline-offset-2 hover:text-white transition">
                Please let me know if you have any feedback.
              </a>
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
