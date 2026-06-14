import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";
import { toEpisodes } from "@/lib/tmdb/episodes";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; n: string }> },
) {
  const { id, n } = await params;
  const tvId = Number(id);
  const seasonNumber = Number(n);
  if (!Number.isInteger(tvId) || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
    return NextResponse.json({ error: "Invalid id or season" }, { status: 400 });
  }
  try {
    const data = await tmdb.season(tvId, seasonNumber);
    return NextResponse.json({ episodes: toEpisodes(data) });
  } catch {
    return NextResponse.json({ error: "Season unavailable" }, { status: 502 });
  }
}
