import { NextRequest, NextResponse } from "next/server";
import { translateViolation } from "./translations";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const workerUrl = process.env.WORKER_URL ?? "http://localhost:3001";

    const response = await fetch(`${workerUrl}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 500 });
    }

    const translated = data.violations.map((v: any) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      ...translateViolation(v.id),
    }));

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
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
