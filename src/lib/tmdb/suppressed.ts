// Titles we treat as nonexistent: junk or duplicate TMDB entries that clash with
// the canonical record (no IMDb id, no votes, empty metadata). They are filtered
// out of search/browse/recommendations and 404 on the title page, so they can't
// compete with the real show. Keyed `${mediaType}:${tmdbId}`.

const SUPPRESSED = new Set<string>([
  // Duplicate of tv/61859 (BBC One, IMDb tt1399664). This is the German broadcast
  // of the same series, logged as a separate show with no IMDb id, no networks,
  // 0 votes and an empty overview.
  "tv:324254", // The Night Manager (dup)
]);

export function isSuppressedTitle(mediaType: "movie" | "tv", tmdbId: number): boolean {
  return SUPPRESSED.has(`${mediaType}:${tmdbId}`);
}
