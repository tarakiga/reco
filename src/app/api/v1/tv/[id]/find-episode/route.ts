import { NextResponse } from "next/server";
import { findEpisodes } from "@/services/episode-search";

// Cold-cache builds fetch every season of a show; give long-runners room.
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tvId = Number(id);
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!Number.isInteger(tvId) || q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  try {
    return NextResponse.json({ results: await findEpisodes(tvId, q) });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
