import { NextResponse } from "next/server";
import { cacheLife } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { blendPicks } from "@/lib/onboarding/picks";

/**
 * Two Discover calls, cached per (genre set, page). Popularity ordering moves
 * slowly, and uncached this ran both calls on every onboarding grid request.
 * The genre key is sorted by the caller so ?genres=1,2 and ?genres=2,1 share
 * one entry rather than each paying for its own pair of calls.
 */
async function picksFor(genreKey: string, page: string) {
  "use cache";
  cacheLife("hours");

  // `|` = OR (titles in ANY chosen genre). Comma would be AND, which returns
  // ~nothing for a typical 3+ diverse-genre onboarding selection.
  const params = { with_genres: genreKey, sort_by: "popularity.desc", "vote_count.gte": "300", page };

  // Don't let one failing discover call empty the whole grid.
  const [movieR, tvR] = await Promise.allSettled([
    tmdb.discover("movie", params),
    tmdb.discover("tv", params),
  ]);
  const movie = movieR.status === "fulfilled" ? movieR.value.results : [];
  const tv = tvR.status === "fulfilled" ? tvR.value.results : [];
  return blendPicks(movie, tv);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const genreIds = (url.searchParams.get("genres") ?? "").split(",").filter(Boolean).slice(0, 10);
  const page = String(Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1));
  if (genreIds.length === 0) return NextResponse.json({ picks: [] });

  return NextResponse.json({ picks: await picksFor([...genreIds].sort().join("|"), page) });
}
