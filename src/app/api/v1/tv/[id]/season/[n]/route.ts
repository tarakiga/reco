import { NextResponse } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { toEpisodes } from "@/lib/tmdb/episodes";

/** A season's episode list. Cached per show+season: the data is near-static, and
 *  this endpoint is public, so uncached it cost a TMDB call on every request.
 *  A failed season fetch throws rather than returning empty, so a transient
 *  TMDB error is never cached in place of a real season. */
async function seasonEpisodes(tvId: number, seasonNumber: number) {
  "use cache";
  cacheLife("days");
  cacheTag(`tv-season:${tvId}:${seasonNumber}`);
  return toEpisodes(await tmdb.season(tvId, seasonNumber));
}

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
