"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

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
    overlay: "rgba(52, 211, 153, 0.15)",
    stroke: "#34d399",
    strokeRgb: [52, 211, 153],
    activeBg: "bg-emerald-500/10",
    accentBar: "bg-emerald-400",
    numBg: "bg-emerald-500/20 text-emerald-300",
  },
  Moderate: {
    label: "Moderate Effort",
    sublabel: "Plan for next sprint",
    badge: "bg-yellow-500/10 text-yellow-400",
    overlay: "rgba(251, 191, 36, 0.15)",
    stroke: "#fbbf24",
    strokeRgb: [251, 191, 36],
    activeBg: "bg-yellow-500/10",
    accentBar: "bg-yellow-400",
    numBg: "bg-yellow-500/20 text-yellow-300",
  },
  Complex: {
    label: "Complex Fixes",
    sublabel: "Requires design + dev",
    badge: "bg-red-500/10 text-red-400",
    overlay: "rgba(248, 113, 113, 0.15)",
    stroke: "#f87171",
    strokeRgb: [248, 113, 113],
    activeBg: "bg-red-500/10",
    accentBar: "bg-red-400",
    numBg: "bg-red-500/20 text-red-300",
  },
};

const HISTORY_KEY = "url-scan-history";
const MAX_HISTORY = 20;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function UrlInput({
  value,
  onChange,
  history,
  placeholder,
  inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  history: string[];
  placeholder?: string;
  inputClassName?: string;
}) {
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [savedInput, setSavedInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return history.slice(0, 6);
    return history.filter((h) => h.toLowerCase().includes(q)).slice(0, 6);
  }, [value, history]);

  function commit(url: string) {
    onChange(url);
    setOpen(false);
    setHistoryIdx(-1);
    inputRef.current?.focus();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setHistoryIdx(-1);
    onChange(e.target.value);
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(false);
      if (historyIdx === -1) setSavedInput(value);
      const next = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(next);
      if (history[next] !== undefined) onChange(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(false);
      if (historyIdx === -1) return;
      if (historyIdx === 0) {
        setHistoryIdx(-1);
        onChange(savedInput);
      } else {
        const next = historyIdx - 1;
        setHistoryIdx(next);
        if (history[next] !== undefined) onChange(history[next]);
      }
    } else if (e.key === "Escape") {
      if (open) { setOpen(false); }
      else if (historyIdx >= 0) { setHistoryIdx(-1); onChange(savedInput); }
    }
  }

  const showDropdown = open && value.trim().length > 0 && suggestions.length > 0;

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={inputClassName}
      />
      {showDropdown && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden shadow-2xl">
          {suggestions.map((url) => (
            <button
              key={url}
              type="button"
              onMouseDown={() => commit(url)}
              className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-white transition truncate block"
            >
              {url}
            </button>
          ))}
        </div>
      )}
    </div>
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
      <span className="text-xs">{copied ? "✓" : "⎘"}</span>
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

// Canvas overlay component — draws everything in one GPU layer
function CanvasOverlay({
  violations,
  activeViolation,
  hiddenEfforts,
  pageWidth,
  pageHeight,
  onViolationClick,
}: {
  violations: NumberedViolation[];
  activeViolation: NumberedViolation | null;
  hiddenEfforts: Set<string>;
  pageWidth: number;
  pageHeight: number;
  onViolationClick: (v: NumberedViolation | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<"pointer" | "default">("default");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const scaleX = W / pageWidth;
    const scaleY = H / pageHeight;
    const isAnyActive = activeViolation !== null;

    // ── Pass 1: dark veil over entire screenshot ──────────────────────────
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = isAnyActive ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    // ── Pass 2: punch holes — fully reveal selected, subtly reveal others ─
    ctx.globalCompositeOperation = "destination-out";
    for (const v of violations) {
      if (hiddenEfforts.has(v.effort)) continue;
      const isActive = activeViolation?.id === v.id;
      // idle: slight reveal so areas stand out without colour
      // active: full reveal for selected, near-invisible for others
      ctx.globalAlpha = !isAnyActive ? 0.40 : isActive ? 1 : 0.5;
      for (const box of v.boxes ?? []) {
        const x = box.x * scaleX;
        const y = box.y * scaleY;
        const w = box.width * scaleX;
        const h = box.height * scaleY;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // ── Pass 3: number badges only (no strokes) ───────────────────────────
    for (const v of violations) {
      if (hiddenEfforts.has(v.effort)) continue;
      const config = effortConfig[v.effort];
      const isActive = activeViolation?.id === v.id;
      const [r, g, b] = config.strokeRgb;
      const box = (v.boxes ?? [])[0];
      if (!box) continue;

      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const badgeR = 11;
      const bx = x + badgeR + 2;
      const by = y - badgeR + 2;

      ctx.globalAlpha = isAnyActive && !isActive ? 0.35 : 1;
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(${r},${g},${b},0.7)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${badgeR}px DM Sans, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(v.num), bx, by + 0.5);
      ctx.globalAlpha = 1;
    }
  }, [violations, activeViolation, hiddenEfforts, pageWidth, pageHeight]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  function hitTest(mx: number, my: number, rect: DOMRect): NumberedViolation | null {
    const scaleX = rect.width / pageWidth;
    const scaleY = rect.height / pageHeight;
    for (let vi = violations.length - 1; vi >= 0; vi--) {
      const v = violations[vi];
      if (hiddenEfforts.has(v.effort)) continue;
      for (const box of v.boxes ?? []) {
        const x = box.x * scaleX;
        const y = box.y * scaleY;
        const w = box.width * scaleX;
        const h = box.height * scaleY;
        if (mx >= x && mx <= x + w && my >= y && my <= y + h) return v;
      }
    }
    return null;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top, rect);
    setCursor(hit ? "pointer" : "default");
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top, rect);
    if (hit && hit.id === activeViolation?.id) {
      onViolationClick(null);
    } else {
      onViolationClick(hit);
    }
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCursor("default")}
      />
    </div>
  );
}

const SCAN_MESSAGES = ["Fetching page", "Handling banners", "Running WCAG checks", "Compiling results"];

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
  const [urlHistory, setUrlHistory] = useState<string[]>([]);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const leftPanelListRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setUrlHistory(loadHistory()); }, []);

  function pushToHistory(url: string) {
    setUrlHistory((prev) => {
      const next = [url, ...prev.filter((h) => h !== url)].slice(0, MAX_HISTORY);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // Auto-select first violation when results arrive
  useEffect(() => {
    if (violations.length > 0) {
      setActiveViolation({ ...violations[0], num: 1 });
    } else {
      setActiveViolation(null);
    }
  }, [violations]);

  // Auto-scroll left panel to show active violation (expanded)
  useEffect(() => {
    if (!activeViolation || !leftPanelListRef.current) return;
    const container = leftPanelListRef.current;
    requestAnimationFrame(() => {
      const el = container.querySelector<HTMLElement>(`[data-violation-id="${activeViolation.id}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [activeViolation]);

  // Auto-scroll right panel when selected overlay is out of view
  useEffect(() => {
    if (!activeViolation || !rightPanelRef.current || !screenshotRef.current) return;
    const box = activeViolation.boxes?.[0];
    if (!box) return;
    const panel = rightPanelRef.current;
    const screenshot = screenshotRef.current;
    const screenshotRect = screenshot.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const boxFraction = box.y / pageHeight;
    const boxYInContent = screenshotRect.top - panelRect.top + panel.scrollTop + boxFraction * screenshotRect.height;
    const isInView = boxYInContent >= panel.scrollTop && boxYInContent <= panel.scrollTop + panel.clientHeight;
    if (!isInView) {
      panel.scrollTo({ top: Math.max(0, boxYInContent - panel.clientHeight * 0.35), behavior: "smooth" });
    }
  }, [activeViolation, pageHeight]);

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
    const isRescanning = total !== null && screenshot !== null;
    setLoading(true);
    setError(null);
    setActiveViolation(null);
    setHiddenEfforts(new Set());
    if (!isRescanning) {
      setViolations([]);
      setTotal(null);
      setScannedUrl(null);
      setScreenshot(null);
    }

    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fullUrl }),
    });

    const data = await res.json();
    if (data.error) {
      setError(data.error);
    } else {
      pushToHistory(fullUrl);
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

  const [scanMsgIdx, setScanMsgIdx] = useState(0);
  useEffect(() => {
    if (!loading) { setScanMsgIdx(0); return; }
    const id = setInterval(() => setScanMsgIdx((i) => (i + 1) % SCAN_MESSAGES.length), 5000);
    return () => clearInterval(id);
  }, [loading]);

  const hasResults = total !== null && screenshot;
  const score = Math.max(0, 100 - (total ?? 0) * 5);
  const scoreColor = score > 60 ? "#34d399" : score > 30 ? "#fbbf24" : "#f87171";
  const scoreColorLight = score > 60 ? "#a7f3d0" : score > 30 ? "#fde68a" : "#fecaca";
  const numberedViolations: NumberedViolation[] = violations.map((v, i) => ({ ...v, num: i + 1 }));

  return (
    <main className="min-h-screen bg-[#0a0a0a]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
        @keyframes bounce-dot { 0%,80%,100% { transform:translateY(0); opacity:0.4; } 40% { transform:translateY(-4px); opacity:1; } }
        @keyframes fade-msg { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        .fade-up   { animation: fadeUp 0.45s ease both; }
        .fade-up-1 { animation: fadeUp 0.45s 0.09s ease both; }
        .fade-up-2 { animation: fadeUp 0.45s 0.18s ease both; }
        .fade-in   { animation: fadeIn 0.3s ease both; }
        .scanning-dot { animation: pulse-dot 1.2s infinite; }
        .violation-row { transition: background 0.12s; }
        .violation-row:hover { background: rgba(255,255,255,0.035); }
        .chevron { display:inline-block; transition: transform 0.2s ease; }
        .chevron.open { transform: rotate(90deg); }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#2a2a2a; }
      `}</style>

      {/* LANDING */}
      {!hasResults && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-xl">
            <div className="mb-12 fade-up">
              <h1 className="text-white text-5xl mb-3 leading-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>
                Is your website ready<br />
                for the new<br />
                <em className="text-zinc-400" style={{ fontStyle: "italic" }}>European Accessibility Act?</em>
              </h1>
              <p className="text-zinc-300 text-base leading-relaxed max-w-md">
                Paste any URL and get a clear list of accessibility fixes.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mb-10 fade-up-1">
              <div className="flex gap-2">
                <UrlInput
                  value={domain}
                  onChange={setDomain}
                  history={urlHistory}
                  placeholder="Enter URL"
                  inputClassName="w-full bg-white/5 text-white border border-white/15 rounded-lg px-5 py-4 text-sm outline-none focus:border-white/40 transition placeholder-zinc-500"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className={`font-semibold px-7 py-4 rounded-lg transition text-sm whitespace-nowrap ${loading ? "bg-zinc-800 text-white cursor-default" : "bg-white text-black hover:bg-zinc-100 disabled:opacity-40"}`}
                >
                  {loading ? (
                    <span className="flex items-center gap-2.5 min-w-[140px] justify-center">
                      <span className="flex gap-[3px] items-center">
                        <span className="w-1 h-1 rounded-full bg-white" style={{ animation: "bounce-dot 1s 0ms infinite ease-in-out" }} />
                        <span className="w-1 h-1 rounded-full bg-white" style={{ animation: "bounce-dot 1s 160ms infinite ease-in-out" }} />
                        <span className="w-1 h-1 rounded-full bg-white" style={{ animation: "bounce-dot 1s 320ms infinite ease-in-out" }} />
                      </span>
                      <span key={scanMsgIdx} style={{ animation: "fade-msg 0.35s ease both" }}>
                        {SCAN_MESSAGES[scanMsgIdx]}
                      </span>
                    </span>
                  ) : "Scan site"}
                </button>
              </div>
            </form>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-5 py-4 mb-6 fade-up">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 fade-up-2">
              <div className="bg-white/[0.04] border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-zinc-200 text-xs font-semibold uppercase tracking-wider">EU — EAA 2025</span>
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed">
                  European Accessibility Act in force since <span className="text-white font-medium">June 2025</span>. All digital products sold in the EU must comply or face fines.
                </p>
              </div>
              <div className="bg-white/[0.04] border border-white/10 rounded-lg p-4">
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
        <div className="relative flex h-screen overflow-hidden fade-in">

          {/* SCANNING OVERLAY */}
          {loading && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-6">
              <div className="w-14 h-14 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-white text-xl font-medium mb-2">Scanning website...</p>
                <p className="text-zinc-400 text-sm max-w-xs leading-relaxed">
                  Loading the page, handling cookie banners and running WCAG accessibility checks — this may take up to 30 seconds
                </p>
              </div>
            </div>
          )}

          {/* LEFT PANEL */}
          <div className="w-[300px] flex-shrink-0 bg-[#111] border-r border-white/8 flex flex-col h-full">

            {/* Rescan */}
            <div className="px-3 py-3 border-b border-white/8">
              <form onSubmit={handleSubmit} className="flex gap-1.5">
                <UrlInput
                  value={domain}
                  onChange={setDomain}
                  history={urlHistory}
                  placeholder="Enter URL"
                  inputClassName="w-full bg-white/5 text-white border border-white/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-white/40 transition placeholder-zinc-500"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className={`font-semibold px-3 py-2 rounded-lg transition text-xs whitespace-nowrap flex-shrink-0 ${loading ? "bg-zinc-800 text-white cursor-default" : "bg-white text-black hover:bg-zinc-100 disabled:opacity-40"}`}
                >
                  {loading ? (
                    <span className="flex gap-[3px] items-center px-0.5">
                      <span className="w-1 h-1 rounded-full bg-white" style={{ animation: "bounce-dot 1s 0ms infinite ease-in-out" }} />
                      <span className="w-1 h-1 rounded-full bg-white" style={{ animation: "bounce-dot 1s 160ms infinite ease-in-out" }} />
                      <span className="w-1 h-1 rounded-full bg-white" style={{ animation: "bounce-dot 1s 320ms infinite ease-in-out" }} />
                    </span>
                  ) : "Scan"}
                </button>
              </form>
            </div>

            {/* Summary */}
            <div className="px-4 py-4 border-b border-white/8 flex items-center justify-between">
              <div>
                <p className="text-white text-3xl font-light leading-none" style={{ fontFamily: "'DM Serif Display', serif" }}>
                  {total} issues
                </p>
                <p className="text-zinc-400 text-xs truncate max-w-[170px] mt-0.5">{scannedUrl}</p>
              </div>
              <div className="relative w-12 h-12 flex-shrink-0">
                <svg width="48" height="48" viewBox="0 0 48 48">
                  <defs>
                    <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={scoreColorLight} />
                      <stop offset="100%" stopColor={scoreColor} />
                    </linearGradient>
                  </defs>
                  <circle cx="24" cy="24" r="17" fill="none" stroke="#1e1e1e" strokeWidth="6" />
                  <circle
                    cx="24" cy="24" r="17"
                    fill="none"
                    stroke="url(#dialGrad)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 106.8} 106.8`}
                    style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium">
                  {score}
                </span>
              </div>
            </div>

            {error && (
              <div className="mx-3 my-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                <p className="text-red-300 text-xs">{error}</p>
              </div>
            )}

            {/* Violations list */}
            <div ref={leftPanelListRef} className="flex-1 overflow-y-auto">
              {(["Quick win", "Moderate", "Complex"] as const).map((effortLevel) => {
                const group = numberedViolations.filter((v) => v.effort === effortLevel);
                if (group.length === 0) return null;
                const config = effortConfig[effortLevel];

                return (
                  <div key={effortLevel}>
                    <div className="px-4 py-3 flex items-center justify-between sticky top-0 bg-[#111] border-b border-white/5 z-10">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-zinc-200 text-xs font-semibold uppercase tracking-wider">{config.label}</span>
                        <span className="text-zinc-400 text-xs">{config.sublabel}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${config.badge}`}>
                        {group.length}
                      </span>
                    </div>

                    {group.map((v) => {
                      const isActive = activeViolation?.id === v.id;
                      const copyText = `${v.title}\n\nWhy it matters:\n${v.why}\n\nHow to fix:\n${v.fix}\n\nEstimated effort: ${v.effortTime}\nWCAG reference: ${v.wcagUrl}`;

                      return (
                        <div
                          key={v.id}
                          data-violation-id={v.id}
                          className={`violation-row border-b border-white/5 ${isActive ? config.activeBg : ""}`}
                        >
                          <div className="flex">
                            <div className={`w-0.5 flex-shrink-0 ${isActive ? config.accentBar : "bg-transparent"}`} />
                            <button
                              onClick={() => setActiveViolation(isActive ? null : v)}
                              className="flex-1 text-left px-3 py-3"
                            >
                              <div className="flex items-start gap-2">
                                <span
                                  className="flex-shrink-0 w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5 bg-black text-white"
                                  style={{ boxShadow: `0 0 0 1px ${config.stroke}66` }}
                                >
                                  {v.num}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-xs font-medium leading-snug ${isActive ? "text-white" : "text-zinc-200"}`}>
                                    {v.title}
                                  </p>
                                  <p className="text-zinc-400 text-xs mt-0.5">
                                    {v.category}{v.nodes > 1 ? ` · ${v.nodes} elements` : ""}
                                  </p>
                                </div>
                                <span className={`chevron text-zinc-400 flex-shrink-0 text-[28px] leading-none -mt-1 ${isActive ? "open" : ""}`}>›</span>
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
                                    <p className="text-zinc-400 text-xs">Effort: {v.effortTime}</p>
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
                <span className="text-zinc-400 text-xs">✓</span>
                <span className="text-zinc-400 text-xs">WCAG 2.1 AA</span>
              </div>
              <a
                href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 hover:text-white transition text-xs"
              >
                Feedback
              </a>
            </div>
          </div>

          {/* RIGHT — visual */}
          <div ref={rightPanelRef} className="flex-1 overflow-auto bg-[#0d0d0d] p-6">

            {/* Legend / toggle */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {(["Quick win", "Moderate", "Complex"] as const).map((e) => {
                const config = effortConfig[e];
                const isHidden = hiddenEfforts.has(e);
                const count = numberedViolations.filter((v) => v.effort === e).length;
                if (count === 0) return null;
                return (
                  <button
                    key={e}
                    onClick={() => toggleEffort(e)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs ${
                      isHidden
                        ? "border-white/20 bg-white/[0.06] text-zinc-400"
                        : "border-white/10 bg-white/[0.04] text-zinc-300"
                    }`}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-sm border flex-shrink-0 transition-all"
                      style={{
                        background: isHidden ? "transparent" : config.overlay,
                        borderColor: isHidden ? "#666" : config.stroke,
                      }}
                    />
                    {config.label}
                    <span className="text-zinc-400">{count}</span>
                    {isHidden && <span className="text-zinc-400 text-xs font-medium ml-0.5">hidden</span>}
                  </button>
                );
              })}
              <span className="text-zinc-400 text-xs ml-auto">Click to select · Click legend to hide</span>
            </div>

            {/* Screenshot + canvas overlay */}
            <div
              ref={screenshotRef}
              className="relative w-full rounded-lg overflow-hidden border border-white/10 shadow-2xl"
              style={{ aspectRatio: `${pageWidth} / ${pageHeight}` }}
              onClick={() => setActiveViolation(null)}
            >
              <img
                src={`data:image/jpeg;base64,${screenshot}`}
                alt="Page screenshot"
                className="w-full h-full object-cover object-top"
                style={{ display: "block" }}
              />
              <CanvasOverlay
                violations={numberedViolations}
                activeViolation={activeViolation}
                hiddenEfforts={hiddenEfforts}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
                onViolationClick={setActiveViolation}
              />
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
