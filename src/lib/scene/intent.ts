export type SceneMediaType = "movie" | "tv";

// Only STRONG, unambiguous media-type signals — deliberately excludes bare
// "series"/"show" so queries like "a series of unfortunate events" aren't mangled.
const TV_PATTERNS = /\b(tv[-\s]?shows?|tv[-\s]?series|television\s+series|mini[-\s]?series|sitcoms?)\b/gi;
const MOVIE_PATTERNS = /\b(movies?|films?)\b/gi;

export interface ParsedSceneQuery {
  /** Detected media-type intent, or null when ambiguous/none. */
  mediaType: SceneMediaType | null;
  /** Query with media-type words + leading filler removed, for embedding. */
  cleaned: string;
}

/**
 * Detect and strip a media-type hint from a free-text scene query so it can drive
 * a hard filter instead of polluting the embedding. Conservative: only acts on
 * explicit phrases ("tv show", "movie", "sitcom", "film"...).
 */
export function parseMediaIntent(raw: string): ParsedSceneQuery {
  const text = (raw ?? "").trim();
  const hasTv = TV_PATTERNS.test(text);
  TV_PATTERNS.lastIndex = 0;
  const hasMovie = MOVIE_PATTERNS.test(text);
  MOVIE_PATTERNS.lastIndex = 0;

  // If both appear it's ambiguous → no filter.
  let mediaType: SceneMediaType | null = null;
  if (hasTv && !hasMovie) mediaType = "tv";
  else if (hasMovie && !hasTv) mediaType = "movie";

  let cleaned = text
    .replace(TV_PATTERNS, " ")
    .replace(MOVIE_PATTERNS, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Drop leading filler ("the one where with", "that ... about", etc.) so the
  // embedded text starts at the actual scene description. Mid-sentence words kept.
  cleaned = cleaned
    .replace(/^(?:(?:the|a|an|that|this|where|with|about|of|in|me|find|one|some)\b\s*)+/i, "")
    .trim();

  return { mediaType, cleaned: cleaned || text };
}
