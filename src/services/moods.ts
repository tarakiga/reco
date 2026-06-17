import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { toBrowseResults } from "@/lib/tmdb/discover";
import type { TitleResult } from "@/lib/tmdb/transform";
import { getMoodBySlug, type MoodQuery } from "@/lib/moods";

function buildParams(q: MoodQuery, page: number): Record<string, string> {
  const p: Record<string, string> = {
    sort_by: q.sortBy ?? "popularity.desc",
    include_adult: "false",
    "vote_count.gte": String(q.voteCountGte ?? 100),
    page: String(page),
  };
  if (q.withGenres) p.with_genres = q.withGenres;
  if (q.withoutGenres) p.without_genres = q.withoutGenres;
  if (q.withKeywords) p.with_keywords = q.withKeywords;
  if (q.voteAverageGte != null) p["vote_average.gte"] = String(q.voteAverageGte);
  return p;
}

/** Titles for a mood, fetched from TMDB Discover. Cached per mood (region-agnostic). */
export async function getMoodTitles(slug: string, pages = 1): Promise<TitleResult[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(`mood:${slug}`);

  const mood = getMoodBySlug(slug);
  if (!mood) return [];
  const mt = mood.query.mediaType ?? "movie";

  const seen = new Set<number>();
  const out: TitleResult[] = [];
  for (let page = 1; page <= pages; page++) {
    const data = await tmdb.discover(mt, buildParams(mood.query, page)).catch(() => null);
    if (!data) break;
    for (const r of toBrowseResults(mt, data.results)) {
      if (seen.has(r.tmdbId)) continue;
      seen.add(r.tmdbId);
      out.push(r);
    }
    if (page >= (data.total_pages ?? 1)) break;
  }
  return out;
}
