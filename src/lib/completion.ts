/** Pure completion helpers shared by server code and client components. */

export interface CompletionItem {
  key: string; // `${mediaType}:${tmdbId}`
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  /** ISO date ("YYYY-MM-DD") or null, used to drop not-yet-released titles. */
  releaseDate: string | null;
  posterUrl: string | null;
  href: string;
}

export interface Progress {
  total: number;
  watched: number;
  /** Titles still to watch, in order. */
  remaining: CompletionItem[];
  /** Titles already seen, in order. */
  seen: CompletionItem[];
}

/**
 * Drop not-yet-released titles (future-dated) so the completion denominator only
 * counts what you can actually watch. Undated titles are kept (usually old
 * catalogue, not upcoming). The caller supplies today's date ("YYYY-MM-DD"), so
 * this stays pure and safe to call from cached code or the browser.
 */
export function releasedItems(items: CompletionItem[], todayYmd: string): CompletionItem[] {
  return items.filter((i) => !i.releaseDate || i.releaseDate <= todayYmd);
}

/** Compute a watched/total split for a set against the user's watched keys. */
export function progressFor(items: CompletionItem[], watched: Set<string>): Progress {
  const seen = items.filter((i) => watched.has(i.key));
  const remaining = items.filter((i) => !watched.has(i.key));
  return { total: items.length, watched: seen.length, remaining, seen };
}
