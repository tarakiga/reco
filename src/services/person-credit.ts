import "server-only";
import { tmdb } from "@/lib/tmdb/client";
import { toEpisodes } from "@/lib/tmdb/episodes";
import type { PersonShowCredit } from "@/lib/tmdb/person";

export type { PersonShowCredit, PersonEpisode } from "@/lib/tmdb/person";

const MAX_SEASONS_SCANNED = 40; // guard against pathological long-runners

/**
 * Resolve how an actor appears in a TV show. TMDB exposes per-episode GUEST
 * stars but not regulars, so: if the person is in the show's main cast we report
 * mainCast; otherwise we scan seasons for the episodes that list them as a guest.
 * Cached — the result is static for a given (person, show).
 */
export async function getPersonShowCredit(personId: number, tvId: number): Promise<PersonShowCredit> {
  "use cache";
  const show = await tmdb.getTitle("tv", tvId);

  if ((show.credits?.cast ?? []).some((c) => c.id === personId)) {
    return { mainCast: true, episodes: [] };
  }

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
          }));
      } catch {
        return [];
      }
    }),
  );

  return { mainCast: false, episodes: perSeason.flat() };
}
