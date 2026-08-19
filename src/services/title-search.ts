import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { toSearchResults, type SearchResult } from "@/lib/tmdb/transform";
import { correctTitleQuery } from "@/lib/search/correct";

export interface SearchOutcome {
  results: SearchResult[];
  /** The corrected spelling actually used, when the original found nothing. */
  corrected: string | null;
}

/**
 * Multi-search with typo tolerance: try the query as typed, and if it finds
 * nothing, ask Gemini to correct the spelling and search again ("emerdale" →
 * "Emmerdale"). Returns `corrected` so the UI can say "showing results for …".
 */
export async function searchWithCorrection(query: string): Promise<SearchOutcome> {
  // Normalise before the cache key: TMDB search is case-insensitive, so
  // "Heat", "heat" and "  heat " are one entry rather than three. This path is
  // hit per debounced keystroke by the header autocomplete, the command palette
  // and the poll picker, and it was previously an uncached TMDB call every time.
  const q = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (!q) return { results: [], corrected: null };
  return cachedSearch(q);
}

/** One TMDB round trip per distinct query per few hours, instead of per request. */
async function cachedSearch(q: string): Promise<SearchOutcome> {
  "use cache";
  cacheLife("hours");
  cacheTag("title-search");

  const results = toSearchResults((await tmdb.searchMulti(q)).results);
  if (results.length > 0) return { results, corrected: null };

  const corrected = await correctTitleQuery(q);
  if (!corrected) return { results: [], corrected: null };

  const cResults = toSearchResults((await tmdb.searchMulti(corrected)).results);
  return cResults.length > 0 ? { results: cResults, corrected } : { results: [], corrected: null };
}
