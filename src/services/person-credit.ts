import "server-only";
import { tmdb } from "@/lib/tmdb/client";
import { toEpisodes } from "@/lib/tmdb/episodes";
import type { PersonShowCredit } from "@/lib/tmdb/person";

export type { PersonShowCredit, PersonEpisode } from "@/lib/tmdb/person";

const MAX_SEASONS_SCANNED = 40; // guard against pathological long-runners

/**
 * Resolve how an actor appears in a TV show. TMDB's `credits` is current-season
 * only, so series regulars who left early (e.g. Jill Marie Jones on Girlfriends)
 * aren't in it — we use aggregate_credits for the whole-series cast. Logic:
 *  - clear regular (many episodes) → mainCast + episode count, no scan needed;
 *  - otherwise scan seasons for per-episode guest appearances (the accordion);
 *  - if no guest episodes but they're in the series cast → recurring/regular.
 * Cached — static for a given (person, show).
 */
export async function getPersonShowCredit(personId: number, tvId: number): Promise<PersonShowCredit> {
  "use cache";
  const [show, agg] = await Promise.all([
    tmdb.getTitle("tv", tvId),
    tmdb.tvAggregateCredits(tvId).catch(() => ({ cast: [] as never[] })),
  ]);

  const aggEntry = (agg.cast ?? []).find((c) => c.id === personId);
  const episodeCount = aggEntry?.total_episode_count ?? null;
  const aggCharacter = aggEntry?.roles?.[0]?.character ?? null;

  // Fast path: a clear series regular — skip the (expensive) season scan.
  const total = show.number_of_episodes ?? 0;
  if (aggEntry && episodeCount != null && episodeCount >= Math.max(8, total * 0.2)) {
    return { mainCast: true, episodes: [], episodeCount, character: aggCharacter };
  }

  // Otherwise look for the specific episodes that list them as a guest star.
  const seasonNumbers = (show.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .map((s) => s.season_number)
    .slice(0, MAX_SEASONS_SCANNED);

  const perSeason = await Promise.all(
    seasonNumbers.map(async (n) => {
      try {
        const data = await tmdb.season(tvId, n);
        return toEpisodes(data)
          .filter((e) => e.cast.some((g) => g.id === personId))
          .map((e) => ({
            seasonNumber: n,
            episodeNumber: e.episodeNumber,
            name: e.name,
            year: e.airDate && e.airDate.length >= 4 ? Number(e.airDate.slice(0, 4)) : null,
            character: e.cast.find((g) => g.id === personId)?.character ?? null,
          }));
      } catch {
        return [];
      }
    }),
  );

  const episodes = perSeason.flat();
  if (episodes.length > 0) return { mainCast: false, episodes };

  // No per-episode guest credits, but they're in the series cast → regular.
  if (aggEntry) {
    return { mainCast: true, episodes: [], episodeCount, character: aggCharacter };
  }
  if ((show.credits?.cast ?? []).some((c) => c.id === personId)) {
    return { mainCast: true, episodes: [] };
  }
  return { mainCast: false, episodes: [] };
}
