import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { translateViolation } from "./translations";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle" });

    // Load axe-core script from node_modules as plain text
    const axePath = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");
    const axeScript = fs.readFileSync(axePath, "utf8");

    // Inject it as a plain script into the page
    await page.evaluate(axeScript);

    // Run the analysis
    const results = await page.evaluate(async () => {
      return await (window as any).axe.run();
    });

    await browser.close();

    const translated = results.violations.map((v: any) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      ...translateViolation(v.id),
    }));

    // Sort: quick wins first
    translated.sort((a: any, b: any) => {
      const order: Record<string, number> = { "Quick win": 1, "Moderate": 2, "Complex": 3 };
      return order[a.effort] - order[b.effort];
    });

    return NextResponse.json({
      url,
      violations: translated,
      total: translated.length,
      quickWins: translated.filter((v: any) => v.effort === "Quick win").length,
    });

  } catch (error) {
    await browser.close();
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}