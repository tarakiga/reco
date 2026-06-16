import { NextResponse } from "next/server";
import { searchWithCorrection } from "@/services/title-search";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [], corrected: null });
  try {
    const { results, corrected } = await searchWithCorrection(q);
    return NextResponse.json({ results, corrected });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
