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

export interface WatchProgressSummary {
  counted: number;
  total: number;
  pct: number;
  next: { season: number; episode: number } | null;
}

/**
 * "14 of 62 episodes, next up S2 E3" from the user's watched rows and the
 * show's season list. Null when nothing is watched or nothing is listed, so the
 * caller renders nothing. The total includes a currently airing season's
 * unaired remainder, accepted in the spec: fixing it needs a fetch this feature
 * refuses to add.
 */
export function watchProgressSummary(
  rows: { season: number; episode: number }[],
  seasons: { seasonNumber: number; episodeCount: number }[],
): WatchProgressSummary | null {
  if (rows.length === 0) return null;

  const real = seasons.filter((s) => s.seasonNumber > 0);
  const total = real.reduce((n, s) => n + s.episodeCount, 0);
  if (total === 0) return null;

  const watched = new Set(rows.map((r) => watchKey(r.season, r.episode)));
  // Count only watches that map onto listed real seasons, so a stale mark on a
  // since-removed episode cannot push the bar past 100 percent.
  const counted = rows.filter((r) => {
    const s = real.find((x) => x.seasonNumber === r.season);
    return s != null && r.episode >= 1 && r.episode <= s.episodeCount;
  }).length;
  const next = nextUnwatched(watched, real);
  const pct = Math.min(100, Math.round((counted / total) * 100));
  return { counted, total, pct, next };
}
