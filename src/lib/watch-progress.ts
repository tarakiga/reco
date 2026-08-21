/** The key shape shared with the season accordion's watched set. */
export function watchKey(season: number, episode: number): string {
  return `${season}:${episode}`;
}

/**
 * First episode not in the watched set, walking real seasons in order. Episode
 * numbers are 1..episodeCount, which is how TMDB numbers them, so no episode
 * list fetch is needed. Specials (season 0) are excluded to match the
 * accordion, which hides them. Null when everything listed is watched.
 */
export function nextUnwatched(
  watched: Set<string>,
  seasons: { seasonNumber: number; episodeCount: number }[],
): { season: number; episode: number } | null {
  const real = seasons.filter((s) => s.seasonNumber > 0).sort((a, b) => a.seasonNumber - b.seasonNumber);
  for (const s of real) {
    for (let e = 1; e <= s.episodeCount; e++) {
      if (!watched.has(watchKey(s.seasonNumber, e))) return { season: s.seasonNumber, episode: e };
    }
  }
  return null;
}
