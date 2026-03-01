import { NextRequest, NextResponse } from "next/server";
import { translateViolation } from "./translations";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiter — only active when Upstash env vars are present (skipped in local dev)
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(3, "24 h"),
      })
    : null;

export const runtime = "nodejs";
export const maxDuration = 60;

// Maps Wave item IDs → our violation IDs (axe-compatible where possible)
const WAVE_ID_MAP: Record<string, string> = {
  // Errors
  "alt_missing":          "image-alt",
  "alt_link_missing":     "image-alt",
  "alt_spacer_missing":   "image-alt",
  "alt_input_missing":    "input-image-alt",
  "label_missing":        "label",
  "label_empty":          "label",
  "label_multiple":       "label",
  "contrast":             "color-contrast",
  "link_empty":           "link-name",
  "button_empty":         "button-name",
  "language_missing":     "html-has-lang",
  "th_empty":             "th-empty",
  "th_col_missing":       "th-col-missing",
  "th_row_missing":       "th-row-missing",
  "link_skip_broken":     "link-skip-broken",
  // Alerts
  "alt_redundant":        "image-redundant-alt",
  "alt_long":             "alt-too-long",
  "alt_suspicious":       "alt-suspicious",
  "heading_skipped":      "heading-order",
  "heading_missing":      "page-has-heading-one",
  "heading_possible":     "heading-possible",
  "link_redundant":       "link-redundant",
  "link_internal_broken": "link-broken",
  "table_layout":         "table-layout",
  "fieldset_missing":     "fieldset-missing",
  "label_orphaned":       "label-orphaned",
  "tabindex":             "tabindex",
  "meta_refresh":         "meta-refresh",
  "pdf":                  "pdf-document",
};

// Alerts worth surfacing (ignore niche / deprecated items)
const ALERT_ALLOWLIST = new Set([
  "alt_redundant", "alt_long", "alt_suspicious",
  "link_redundant", "link_internal_broken",
  "heading_missing", "heading_skipped", "heading_possible",
  "table_layout", "fieldset_missing", "label_orphaned",
  "meta_refresh", "pdf", "tabindex",
]);

async function fetchWaveViolations(
  url: string,
): Promise<{ id: string; nodes: number; impact: string }[]> {
  const key = process.env.WAVE_API_KEY;
  if (!key) return [];

  try {
    const waveRes = await fetch(
      `https://wave.webaim.org/api/request?key=${encodeURIComponent(key)}&url=${encodeURIComponent(url)}&format=json&reporttype=2`,
      { signal: AbortSignal.timeout(30000) },
    );
    if (!waveRes.ok) return [];

    const data = await waveRes.json();
    if (!data?.status?.success) return [];

    const violations: { id: string; nodes: number; impact: string }[] = [];
    const cats = data.categories ?? {};

    // Errors — high confidence
    for (const [waveId, item] of Object.entries<any>(cats.error?.items ?? {})) {
      if (item.count > 0) {
        violations.push({ id: WAVE_ID_MAP[waveId] ?? `wave-${waveId}`, nodes: item.count, impact: "serious" });
      }
    }

    // Contrast errors
    for (const [waveId, item] of Object.entries<any>(cats.contrast?.items ?? {})) {
      if (item.count > 0) {
        violations.push({ id: WAVE_ID_MAP[waveId] ?? `wave-${waveId}`, nodes: item.count, impact: "serious" });
      }
    }

    // Alerts — selected subset
    for (const [waveId, item] of Object.entries<any>(cats.alert?.items ?? {})) {
      if (item.count > 0 && ALERT_ALLOWLIST.has(waveId)) {
        violations.push({ id: WAVE_ID_MAP[waveId] ?? `wave-${waveId}`, nodes: item.count, impact: "moderate" });
      }
    }

    return violations;
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const bypassKey = req.headers.get("x-bypass-key") ?? "";
  const isBypassed =
    process.env.RATE_LIMIT_BYPASS_KEY &&
    bypassKey === process.env.RATE_LIMIT_BYPASS_KEY;

  if (ratelimit && !isBypassed) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    const { success, reset } = await ratelimit.limit(ip);
    if (!success) {
      const retryAfterSecs = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: `You've used your 3 free scans for today. Try again in ${Math.ceil(retryAfterSecs / 3600)} hour(s).` },
        { status: 429, headers: { "Retry-After": String(retryAfterSecs) } },
      );
    }
  }

  try {
    const workerUrl = process.env.WORKER_URL ?? "http://localhost:3001";

    // Run Playwright/axe worker and Wave API in parallel
    const [workerResponse, waveViolations] = await Promise.all([
      fetch(`${workerUrl}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(55000),
      }),
      fetchWaveViolations(url),
    ]);

    const data = await workerResponse.json();

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 500 });
    }

    // Translate axe violations (these have bounding boxes)
    // Filter out page-level container boxes (html/body/main spanning most of the page)
    // — these create huge overlays that obscure the real content.
    const axeViolationIds = new Set<string>();
    const translated = data.violations.map((v: any) => {
      axeViolationIds.add(v.id);
      const filteredBoxes = (v.boxes ?? []).filter(
        (b: any) => !(b.width >= 1200 && b.height >= 500),
      );
      return {
        id: v.id,
        impact: v.impact,
        nodes: v.nodes,
        boxes: filteredBoxes,
        ...translateViolation(v.id),
      };
    });

    // Add Wave-only violations (not already found by axe), no bounding boxes
    const waveSeenIds = new Set<string>();
    for (const wv of waveViolations) {
      if (axeViolationIds.has(wv.id)) continue; // axe already covers it with boxes
      if (waveSeenIds.has(wv.id)) continue;     // dedup within wave results
      waveSeenIds.add(wv.id);
      translated.push({
        id: wv.id,
        impact: wv.impact,
        nodes: wv.nodes,
        boxes: [],
        ...translateViolation(wv.id),
      });
    }

    translated.sort((a: any, b: any) => {
      const order: Record<string, number> = { "Quick win": 1, "Moderate": 2, "Complex": 3 };
      return order[a.effort] - order[b.effort];
    });

    return NextResponse.json({
      url,
      violations: translated,
      total: translated.length,
      quickWins: translated.filter((v: any) => v.effort === "Quick win").length,
      screenshot: data.screenshot,
      pageWidth: data.pageWidth,
      pageHeight: data.pageHeight,
    });

  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
