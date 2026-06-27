import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { toBrowseResults } from "@/lib/tmdb/discover";
import { CHALLENGES, getChallenge, type Challenge } from "@/lib/challenges";
import { progressFor, watchedTitleKeys, type CompletionItem, type Progress } from "./completion";

/** The films in a challenge (TMDB Discover, up to 3 pages). Cached per challenge. */
async function challengeItems(c: Challenge): Promise<CompletionItem[]> {
  "use cache";
  cacheLife("days");
  cacheTag(`challenge:${c.slug}`);
  const seen = new Set<number>();
  const out: CompletionItem[] = [];
  for (let page = 1; page <= 3; page++) {
    const data = await tmdb
      .discover("movie", { ...c.discover, include_adult: "false", page: String(page) })
      .catch(() => null);
    if (!data) break;
    for (const r of toBrowseResults("movie", data.results)) {
      if (seen.has(r.tmdbId)) continue;
      seen.add(r.tmdbId);
      out.push({
        key: `movie:${r.tmdbId}`,
        mediaType: "movie",
        tmdbId: r.tmdbId,
        title: r.title,
        year: r.year,
        releaseDate: null,
        posterUrl: r.posterUrl,
        href: r.href,
      });
    }
    if (page >= (data.total_pages ?? 1)) break;
  }
  return out;
}

export interface ChallengeProgress extends Progress {
  challenge: Challenge;
}

export async function challengeProgress(userId: string | null, slug: string): Promise<ChallengeProgress | null> {
  const c = getChallenge(slug);
  if (!c) return null;
  const [items, watched] = await Promise.all([
    challengeItems(c),
    userId ? watchedTitleKeys(userId) : Promise.resolve(new Set<string>()),
  ]);
  return { challenge: c, ...progressFor(items, watched) };
}

export async function allChallengesProgress(
  userId: string | null,
): Promise<{ challenge: Challenge; total: number; watched: number }[]> {
  const watched = userId ? await watchedTitleKeys(userId) : new Set<string>();
  return Promise.all(
    CHALLENGES.map(async (c) => {
      const items = await challengeItems(c);
      const p = progressFor(items, watched);
      return { challenge: c, total: p.total, watched: p.watched };
    }),
  );
}
