import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";
import { toSearchResults } from "@/lib/tmdb/transform";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  try {
    const data = await tmdb.searchMulti(q);
    return NextResponse.json({ results: toSearchResults(data.results) });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
