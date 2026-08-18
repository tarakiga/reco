import { NextResponse } from "next/server";
import { seasonEpisodes } from "@/services/tv-season";

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
    return NextResponse.json({ episodes: await seasonEpisodes(tvId, seasonNumber) });
  } catch {
    return NextResponse.json({ error: "Season unavailable" }, { status: 502 });
  }
}
