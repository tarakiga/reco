import "server-only";
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
  const q = query.trim();
  if (!q) return { results: [], corrected: null };

  const results = toSearchResults((await tmdb.searchMulti(q)).results);
  if (results.length > 0) return { results, corrected: null };

  const corrected = await correctTitleQuery(q);
  if (!corrected) return { results: [], corrected: null };

  const cResults = toSearchResults((await tmdb.searchMulti(corrected)).results);
  return cResults.length > 0 ? { results: cResults, corrected } : { results: [], corrected: null };
}
