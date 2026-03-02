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
    badge: "bg-blue-500/10 text-blue-400",
    overlay: "rgba(29, 78, 216, 0.12)",
    stroke: "#1e3a8a",
    strokeRgb: [96, 165, 250],
    activeBg: "bg-blue-500/5",
    accentBar: "bg-blue-400",
    numBg: "bg-blue-500/20 text-blue-300",
    badgeFill: "rgb(173, 210, 252)",   // sky blue pastel
    badgeStroke: "rgb(110, 170, 235)", // medium blue
  },
  Moderate: {
    label: "Moderate Effort",
    sublabel: "Plan for next sprint",
    badge: "bg-yellow-500/10 text-yellow-400",
    overlay: "rgba(195, 113, 37, 0.15)",
    stroke: "#995d24",
    strokeRgb: [251, 191, 36],
    activeBg: "bg-yellow-500/5",
    accentBar: "bg-yellow-400",
    numBg: "bg-yellow-500/20 text-yellow-300",
    badgeFill: "rgb(236, 210, 165)",   // warm sand pastel
    badgeStroke: "rgb(196, 164, 108)", // deeper sand
  },
  Complex: {
    label: "Complex Fixes",
    sublabel: "Requires design + dev",
    badge: "bg-red-500/10 text-red-400",
    overlay: "rgba(179, 65, 65, 0.15)",
    stroke: "#731e1e",
    strokeRgb: [248, 113, 113],
    activeBg: "bg-red-500/5",
    accentBar: "bg-red-400",
    numBg: "bg-red-500/20 text-red-300",
    badgeFill: "rgb(77, 14, 86)",   // dusty rose pastel
    badgeStroke: "rgb(183, 128, 128)", // deeper rose
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setHistoryIdx(-1);
    onChange(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIdx === -1) setSavedInput(value);
      const next = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(next);
      if (history[next] !== undefined) onChange(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
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
      if (historyIdx >= 0) { setHistoryIdx(-1); onChange(savedInput); }
    }
  }

  return (
    <div className="relative flex-1 min-w-0">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName}
      />
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
      className="flex items-center gap-1 text-zinc-400 hover:text-white transition text-sm"
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
  showCanvas,
  onViolationClick,
}: {
  violations: NumberedViolation[];
  activeViolation: NumberedViolation | null;
  hiddenEfforts: Set<string>;
  pageWidth: number;
  pageHeight: number;
  showCanvas: boolean;
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
    const W = container.offsetWidth;
    const H = container.offsetHeight;

    // Only update buffer dimensions when they actually change —
    // avoids triggering ResizeObserver on every draw call.
    if (canvas.width !== W * dpr) canvas.width = W * dpr;
    if (canvas.height !== H * dpr) canvas.height = H * dpr;
    // Let CSS (w-full h-full) handle visual sizing — never set style.width/height.

    if (!showCanvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, W, H);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // absolute — never compounds across draws
    ctx.clearRect(0, 0, W, H);

    const scaleX = W / pageWidth;
    const scaleY = H / pageHeight;

    // ── Pass 1: dark veil over entire screenshot ──────────────────────────
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0,0,0,0.70)";
    ctx.fillRect(0, 0, W, H);

    // ── Pass 2: punch holes — skip boxes that substantially overlap an already-drawn one ─
    const drawnBoxes: Array<{x: number; y: number; w: number; h: number}> = [];
    const overlapsDrawn = (sx: number, sy: number, sw: number, sh: number) =>
      drawnBoxes.some(d => {
        const ix = Math.max(0, Math.min(sx + sw, d.x + d.w) - Math.max(sx, d.x));
        const iy = Math.max(0, Math.min(sy + sh, d.y + d.h) - Math.max(sy, d.y));
        const inter = ix * iy;
        const smaller = Math.min(sw * sh, d.w * d.h);
        return smaller > 0 && inter / smaller > 0.4;
      });

    ctx.globalCompositeOperation = "destination-out";
    for (const v of violations) {
      if (hiddenEfforts.has(v.effort)) continue;
      const isActive = activeViolation?.id === v.id;
      ctx.globalAlpha = isActive ? 1 : 0.6;
      for (const box of v.boxes ?? []) {
        const x = box.x * scaleX;
        const y = box.y * scaleY;
        const w = box.width * scaleX;
        const h = box.height * scaleY;
        if (overlapsDrawn(x, y, w, h)) continue;
        drawnBoxes.push({ x, y, w, h });
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // ── Pass 3: one badge per violation at its first box ─────────────────
    const badgeSize = 22;
    for (const v of violations) {
      if (hiddenEfforts.has(v.effort)) continue;
      const box = (v.boxes ?? [])[0];
      if (!box) continue;
      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const bx = Math.max(badgeSize / 2 + 2, x + badgeSize / 2 + 2);
      const by = Math.max(badgeSize / 2 + 2, y - badgeSize / 2 + 2);

      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.roundRect(bx - badgeSize / 2, by - badgeSize / 2, badgeSize, badgeSize, 4);
      ctx.fillStyle = "#131313";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px DM Sans, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(v.num), bx, by + 0.5);
    }
  }, [violations, activeViolation, hiddenEfforts, pageWidth, pageHeight, showCanvas]);

  // Keep a stable ref so the ResizeObserver never needs to be recreated.
  const drawRef = useRef(draw);
  useEffect(() => { drawRef.current = draw; }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => drawRef.current());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []); // created once — drawRef always points to latest draw

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
    if (!showCanvas) return;
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
  const [showCanvas, setShowCanvas] = useState(true);
  const [urlHistory, setUrlHistory] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<"position" | "impact">("position");
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const leftPanelListRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setUrlHistory(loadHistory()); }, []);
  useEffect(() => {
    if (window.innerWidth < 768) setSortMode("impact");
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("bypass");
    if (key) {
      try { localStorage.setItem("bypass-key", key); } catch {}
      // Clean the key from the URL without a page reload
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
    }
  }, []);

  function pushToHistory(url: string) {
    setUrlHistory((prev) => {
      const next = [url, ...prev.filter((h) => h !== url)].slice(0, MAX_HISTORY);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // Auto-select first violation when results arrive (uses sorted order so #1 is always topmost)
  useEffect(() => {
    if (numberedViolations.length > 0) {
      setActiveViolation(numberedViolations[0]);
    } else {
      setActiveViolation(null);
    }
  }, [violations]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const bypassKey = typeof window !== "undefined"
      ? (localStorage.getItem("bypass-key") ?? "")
      : "";
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bypassKey ? { "x-bypass-key": bypassKey } : {}),
      },
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
  const scoreColor = score > 60 ? "rgb(26, 128, 90)" : score > 30 ? "#c8854a" : "#f87171";
  const scoreColorLight = score > 60 ? "#377b5b" : score > 30 ? "#d68454" : "#e95b5b";
  const numberedViolations = useMemo<NumberedViolation[]>(() => {
    if (sortMode === "position") {
      return [...violations]
        .sort((a, b) => (a.boxes[0]?.y ?? 999999) - (b.boxes[0]?.y ?? 999999))
        .map((v, i) => ({ ...v, num: i + 1 }));
    }
    return violations.map((v, i) => ({ ...v, num: i + 1 }));
  }, [violations, sortMode]);

  const makeRow = (v: NumberedViolation, showEffortPill: boolean) => {
    const isActive = activeViolation?.id === v.id;
    const config = effortConfig[v.effort];
    const copyText = `${v.title}\n\nWhy it matters:\n${v.why}\n\nHow to fix:\n${v.fix}\n\nEstimated effort: ${v.effortTime}\nWCAG reference: ${v.wcagUrl}`;
    return (
      <div
        key={v.id}
        data-violation-id={v.id}
        className={`violation-row border-b border-white/5 ${isActive ? config.activeBg : ""}`}
      >
        <div className="flex">
          <button
            onClick={() => setActiveViolation(isActive ? null : v)}
            className="flex-1 text-left px-3 py-4"
          >
            <div className="flex items-start gap-2">
              <span
                className="flex-shrink-0 w-5 h-5 rounded-[4px] flex items-center justify-center text-xs font-bold mt-0.5 bg-[#1e1e1e] text-white"
                style={{ boxShadow: `0 0 0 1px ${config.stroke}66` }}
              >
                {v.num}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium leading-snug ${isActive ? "text-white" : "text-zinc-200"}`}>
                  {v.title}
                </p>
                {!isActive && (
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-zinc-400 text-[13px]">
                      {v.category}{v.nodes > 1 ? ` · ${v.nodes} elements` : ""}
                    </span>
                    {showEffortPill && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-[4px] font-medium leading-none ${config.badge}`}>
                        {v.effort === "Quick win" ? "Quick" : v.effort}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <span className={`chevron text-zinc-400 flex-shrink-0 text-[28px] leading-none -mt-1 ${isActive ? "open" : ""}`}>›</span>
            </div>

            {isActive && (
              <div className="mt-3 ml-7 select-text" onClick={(e) => e.stopPropagation()}>
                <p className="text-zinc-400 text-sm mb-1">
                  {v.category}{v.nodes > 1 ? ` · ${v.nodes} elements` : ""}
                </p>
                <span className={`inline-block text-xs px-1.5 py-0.5 rounded-[4px] font-medium leading-none mb-4 ${config.badge}`}>
                  {v.effort === "Quick win" ? "Quick" : v.effort}
                </span>
                <p className="text-zinc-300 text-sm leading-relaxed mb-4">{v.why}</p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-emerald-300 text-sm font-semibold uppercase tracking-[0.7px]">
                    Fix {v.effortTime}
                  </span>
                  <CopyButton text={copyText} />
                </div>
                <p className="text-zinc-200 text-sm leading-relaxed mb-4">{v.fix}</p>
                <a
                  href={v.wcagUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-300 hover:text-white transition text-sm underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  WCAG guideline
                </a>
              </div>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#131313]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,opsz,wght@0,18..144,300..900;1,18..144,300..900&display=swap');
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
          <div className="w-full max-w-[576px]">
            <div className="mb-16 fade-up">
              <h1 className="text-white text-5xl mb-4 leading-[60px]" style={{ fontFamily: "'DM Serif Display', serif" }}>
                Let&apos;s make the web more accessible
              </h1>
              <p className="text-[#d4d4d8] text-base leading-[26px]">
                Enter any URL and to check it against WCAG guidelines.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mb-8 fade-up-1">
              <div className="flex gap-2">
                <UrlInput
                  value={domain}
                  onChange={setDomain}
                  history={urlHistory}
                  placeholder="tarom.ro"
                  inputClassName="w-full h-[54px] bg-white/5 text-white border border-white/40 rounded-[4px] px-5 text-sm outline-none focus:border-white/60 transition placeholder-[#71717b]"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="font-semibold px-7 h-[54px] rounded-[4px] transition text-sm whitespace-nowrap bg-[#27272a] text-white hover:bg-[#3f3f46] disabled:opacity-40"
                >
                  {loading ? (
                    <span className="flex items-center gap-2.5 min-w-[180px] justify-center">
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
              <div className="bg-red-500/10 border border-red-500/30 rounded-[4px] px-5 py-4 mb-6 fade-up">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 fade-up-2">
              <div className="bg-white/[0.04] border border-white/10 rounded-[4px] pt-[17px] px-[17px] pb-px">
                <div className="flex items-center gap-2 mb-2">
                  <img src="https://www.figma.com/api/mcp/asset/927202cb-3c4c-4d3e-b832-008e7cfc16f7" alt="EU flag" className="w-4 h-4 object-cover flex-shrink-0" />
                  <span className="text-[#e4e4e7] text-xs font-semibold uppercase tracking-[0.6px]">EU — EAA 2025</span>
                </div>
                <p className="text-[#d4d4d8] text-xs leading-[19.5px]">
                  European Accessibility Act in force since <span className="text-white font-medium">June 2025</span>. All digital products sold in the EU must comply or face fines.
                </p>
              </div>
              <div className="bg-white/[0.04] border border-white/10 rounded-[4px] pt-[17px] px-[17px] pb-px">
                <div className="flex items-center gap-2 mb-2">
                  <img src="https://www.figma.com/api/mcp/asset/efe1b2d2-74f4-43be-bb99-8e2218a09ffa" alt="US flag" className="w-4 h-4 object-cover flex-shrink-0" />
                  <span className="text-[#e4e4e7] text-xs font-semibold uppercase tracking-[0.6px]">US — ADA Title III</span>
                </div>
                <p className="text-[#d4d4d8] text-xs leading-[19.5px]">
                  US courts consistently rule websites must comply with ADA. <span className="text-white font-medium">Thousands of lawsuits</span> filed annually.
                </p>
              </div>
            </div>

            <p className="mt-8 text-[#9f9fa9] text-xs text-center leading-[16px] fade-up-2 max-w-[430px] mx-auto">
              Both laws reference <span className="text-[#e4e4e7]">WCAG 2.1 AA</span> as the compliance standard. Please double check results as I am working on improving this.{" "}
              <a href="https://www.linkedin.com/in/tudor-teisanu-7b08a4b2/" target="_blank" rel="noopener noreferrer" className="underline decoration-solid hover:text-[#e4e4e7] transition">
                Any feedback?
              </a>
            </p>
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
          <div className="w-[360px] flex-shrink-0 bg-[#181818] border-r border-white/8 flex flex-col h-full">

            {/* Rescan */}
            <div className="px-3 py-3 border-b border-white/8">
              <form onSubmit={handleSubmit} className="flex gap-1.5">
                <UrlInput
                  value={domain}
                  onChange={setDomain}
                  history={urlHistory}
                  placeholder="Enter URL"
                  inputClassName="w-full bg-white/5 text-white border border-white/15 rounded-[4px] px-3 py-2 text-sm outline-none focus:border-white/40 transition placeholder-zinc-500"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className={`font-semibold px-3 py-2 rounded-[4px] transition text-sm whitespace-nowrap flex-shrink-0 text-white ${loading ? "bg-zinc-700 cursor-default opacity-100" : "bg-white !text-black hover:bg-zinc-100 disabled:opacity-40"}`}
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

            {/* Summary - Score */}
            <div className="px-5 pt-5 pb-4 border-b border-white/8">
              <div className="flex items-end gap-6">
                <div>
                  <p
                    className="leading-none tabular-nums"
                    style={{ fontFamily: "'Merriweather', serif", fontSize: "64px", color: scoreColor, lineHeight: "64px" }}
                  >
                    {score}
                  </p>
                  <p className="text-white/50 leading-none mt-1" style={{ fontFamily: "'Merriweather', serif", fontSize: "24px" }}>of 100</p>
                </div>
                <div className="w-[88px] pb-2 flex-shrink-0">
                  <div className="relative h-4 rounded-full overflow-hidden bg-white/5">
                    <div
                      className="absolute left-0 top-0 h-full rounded-l-full transition-all duration-500"
                      style={{ width: `${score}%`, backgroundColor: scoreColor }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mx-3 my-2 bg-red-500/10 border border-red-500/30 rounded-[4px] px-3 py-2">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Sort toggle */}
            <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between flex-shrink-0">
              <span className="text-white/70 text-sm">{total} issues found</span>
              <div className="flex bg-white/[0.06] rounded-[6px] p-0.5">
                {(["position", "impact"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    className={`text-xs px-2.5 py-1 rounded-[4px] transition-all ${
                      sortMode === mode ? "bg-white/15 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {mode === "position" ? "Position in page" : "Impact"}
                  </button>
                ))}
              </div>
            </div>

            {/* Violations list */}
            <div ref={leftPanelListRef} className="flex-1 overflow-y-auto">
              {sortMode === "position" ? (
                (() => {
                  const withLoc = numberedViolations.filter((v) => v.boxes.length > 0);
                  const noLoc = numberedViolations.filter((v) => v.boxes.length === 0);
                  return (
                    <>
                      {withLoc.map((v) => makeRow(v, true))}
                      {noLoc.length > 0 && (
                        <>
                          <div className="px-4 py-3 flex items-center justify-between sticky top-0 bg-[#181818] border-b border-t border-white/5 z-10">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-zinc-200 text-sm font-semibold uppercase tracking-wider">Page-level issues</span>
                              <span className="text-zinc-400 text-sm">No specific element location</span>
                            </div>
                            <span className="text-sm px-2 py-0.5 rounded-[4px] font-medium bg-zinc-500/10 text-zinc-400">
                              {noLoc.length}
                            </span>
                          </div>
                          {noLoc.map((v) => makeRow(v, true))}
                        </>
                      )}
                    </>
                  );
                })()
              ) : (
                (["Quick win", "Moderate", "Complex"] as const).map((effortLevel) => {
                  const group = numberedViolations.filter((v) => v.effort === effortLevel);
                  if (group.length === 0) return null;
                  const config = effortConfig[effortLevel];
                  return (
                    <div key={effortLevel}>
                      <div className="px-4 py-3 flex items-center justify-between sticky top-0 bg-[#181818] border-b border-white/5 z-10">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-zinc-200 text-sm font-semibold uppercase tracking-wider">{config.label}</span>
                          <span className="text-zinc-400 text-sm">{config.sublabel}</span>
                        </div>
                        <span className={`text-sm px-2 py-0.5 rounded-[4px] font-medium ${config.badge}`}>
                          {group.length}
                        </span>
                      </div>
                      {group.map((v) => makeRow(v, false))}
                    </div>
                  );
                })
              )}
            </div>

            {/* Mobile desktop prompt */}
            <p className="md:hidden px-4 py-3 text-zinc-500 text-xs text-center border-t border-white/5 flex-shrink-0">
              To see issues highlighted on the page, open on desktop.
            </p>

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
          <div ref={rightPanelRef} className="flex-1 overflow-auto bg-[#131313] p-6">

            {/* Legend / toggle */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setShowCanvas((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border transition-all text-sm ${
                  showCanvas
                    ? "border-white/20 bg-white/[0.08] text-zinc-200"
                    : "border-white/10 bg-white/[0.03] text-zinc-500"
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-sm border flex-shrink-0 transition-all ${showCanvas ? "bg-white/30 border-white/50" : "bg-transparent border-zinc-600"}`} />
                {showCanvas ? "Overlays on" : "Overlays off"}
              </button>
              {(["Quick win", "Moderate", "Complex"] as const).map((e) => {
                const config = effortConfig[e];
                const isHidden = hiddenEfforts.has(e);
                const count = numberedViolations.filter((v) => v.effort === e).length;
                if (count === 0) return null;
                return (
                  <button
                    key={e}
                    onClick={() => toggleEffort(e)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border transition-all text-sm ${
                      isHidden
                        ? "border-white/10 bg-white/[0.02] text-zinc-600"
                        : "border-white/10 bg-white/[0.04] text-zinc-300"
                    }`}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-sm border flex-shrink-0 transition-all"
                      style={{
                        background: isHidden ? "transparent" : config.overlay,
                        borderColor: isHidden ? "#444" : config.stroke,
                      }}
                    />
                    {config.label}
                    <span className={isHidden ? "text-zinc-600" : "text-zinc-400"}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Screenshot + canvas overlay */}
            <div
              ref={screenshotRef}
              className="relative w-[75%] mx-auto mt-8 rounded-lg border border-white/10 shadow-2xl"
              style={{ aspectRatio: `${pageWidth} / ${pageHeight}` }}
              onClick={() => setActiveViolation(null)}
            >
              <div className="absolute inset-0 overflow-hidden rounded-lg">
                <img
                  src={`data:image/jpeg;base64,${screenshot}`}
                  alt="Page screenshot"
                  className="w-full h-full object-cover object-top"
                  style={{ display: "block" }}
                />
              </div>
              <CanvasOverlay
                violations={numberedViolations}
                activeViolation={activeViolation}
                hiddenEfforts={hiddenEfforts}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
                showCanvas={showCanvas}
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
