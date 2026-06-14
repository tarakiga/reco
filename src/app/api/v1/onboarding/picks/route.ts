import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";
import { blendPicks } from "@/lib/onboarding/picks";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const genres = (url.searchParams.get("genres") ?? "").split(",").filter(Boolean).slice(0, 10).join(",");
  const page = String(Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1));
  if (!genres) return NextResponse.json({ picks: [] });

  const params = { with_genres: genres, sort_by: "popularity.desc", "vote_count.gte": "300", page };
  try {
    const [movie, tv] = await Promise.all([tmdb.discover("movie", params), tmdb.discover("tv", params)]);
    return NextResponse.json({ picks: blendPicks(movie.results, tv.results) });
  } catch {
    return NextResponse.json({ picks: [] });
  }
}
