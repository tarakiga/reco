// Pure round-1 genre-cull logic for "Vote to Watch" — no DB/server deps, so it
// is unit-testable in isolation. The service feeds it loaded title genres.

export const OTHER_GENRE = 0; // bucket for titles with no genre data

export interface CullTitle {
  genreIds: number[];
  title: string;
}

/** Genres whose pick-count ties for the highest (the surviving "top tier"). */
export function topTierGenres(
  votes: { titleId: string }[],
  titleMap: Map<string, CullTitle>,
): Set<number> {
  const count = new Map<number, number>();
  for (const v of votes) {
    const t = titleMap.get(v.titleId);
    if (!t) continue;
    const ids = t.genreIds.length ? t.genreIds : [OTHER_GENRE];
    for (const g of ids) count.set(g, (count.get(g) ?? 0) + 1);
  }
  let max = 0;
  for (const c of count.values()) if (c > max) max = c;
  const top = new Set<number>();
  for (const [g, c] of count) if (c === max && max > 0) top.add(g);
  return top;
}

/**
 * Survivors of the round-1 genre cull, ordered by vote count then title.
 * A title survives if any of its genres is in the top tier. When every pick is
 * a distinct genre (no separation) the top tier holds them all, so nothing is
 * culled and round 2 becomes a straight runoff — the documented fallback.
 */
export function computeSurvivors(
  votes: { titleId: string }[],
  titleMap: Map<string, CullTitle>,
): string[] {
  if (votes.length === 0) return [];
  const top = topTierGenres(votes, titleMap);
  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.titleId, (tally.get(v.titleId) ?? 0) + 1);
  const survivors = [...tally.keys()].filter((id) => {
    const t = titleMap.get(id);
    if (!t) return false;
    const ids = t.genreIds.length ? t.genreIds : [OTHER_GENRE];
    return ids.some((g) => top.has(g));
  });
  survivors.sort((a, b) => {
    const d = (tally.get(b) ?? 0) - (tally.get(a) ?? 0);
    if (d !== 0) return d;
    return (titleMap.get(a)?.title ?? "").localeCompare(titleMap.get(b)?.title ?? "");
  });
  return survivors;
}
