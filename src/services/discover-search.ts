import "server-only";
import { tmdb } from "@/lib/tmdb/client";
import { toBrowseResults } from "@/lib/tmdb/discover";
import type { QueryFilters } from "@/lib/scene/filters";
import type { SceneResult } from "./scene-search";

/**
 * Structured "catalog" search via TMDB Discover — for filter/reputation queries
 * ("cult classics from the 80s", "best 90s sci-fi") where a quality sort + vote
 * floor beats semantic similarity. Returns SceneResult-shaped rows (match=null,
 * since these are filtered, not similarity-ranked) so /find renders them as usual.
 */
export async function discoverSearch(f: QueryFilters, limit: number): Promise<SceneResult[]> {
  const mt = f.mediaType;
  const params: Record<string, string> = {
    sort_by: f.sort,
    include_adult: "false",
    "vote_count.gte": String(f.voteFloor),
  };
  if (f.voteCeil != null) params["vote_count.lte"] = String(f.voteCeil);
  if (f.genreIds.length) params.with_genres = f.genreIds.join(",");
  if (f.excludeGenreIds.length) params.without_genres = f.excludeGenreIds.join(",");
  if (f.runtimeLte != null) params["with_runtime.lte"] = String(f.runtimeLte);
  if (f.yearGte != null) {
    params[mt === "movie" ? "primary_release_date.gte" : "first_air_date.gte"] = `${f.yearGte}-01-01`;
  }
  if (f.yearLte != null) {
    params[mt === "movie" ? "primary_release_date.lte" : "first_air_date.lte"] = `${f.yearLte}-12-31`;
  }

  try {
    const data = await tmdb.discover(mt, params);
    return toBrowseResults(mt, data.results)
      .slice(0, limit)
      .map((r) => ({
        titleId: `d-${r.mediaType}-${r.tmdbId}`,
        tmdbId: r.tmdbId,
        mediaType: r.mediaType,
        title: r.title,
        year: r.year,
        posterUrl: r.posterUrl,
        href: r.href,
        match: null,
      }));
  } catch {
    return [];
  }
}
