import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";
import { blendPicks } from "@/lib/onboarding/picks";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const genreIds = (url.searchParams.get("genres") ?? "").split(",").filter(Boolean).slice(0, 10);
  const page = String(Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1));
  if (genreIds.length === 0) return NextResponse.json({ picks: [] });

  // `|` = OR (titles in ANY chosen genre). Comma would be AND, which returns
  // ~nothing for a typical 3+ diverse-genre onboarding selection.
  const params = { with_genres: genreIds.join("|"), sort_by: "popularity.desc", "vote_count.gte": "300", page };

  // Don't let one failing discover call empty the whole grid.
  const [movieR, tvR] = await Promise.allSettled([
    tmdb.discover("movie", params),
    tmdb.discover("tv", params),
  ]);
  const movie = movieR.status === "fulfilled" ? movieR.value.results : [];
  const tv = tvR.status === "fulfilled" ? tvR.value.results : [];
  return NextResponse.json({ picks: blendPicks(movie, tv) });
}
