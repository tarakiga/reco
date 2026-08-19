import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb, TmdbError } from "@/lib/tmdb/client";
import { toEpisodes, type EpisodeVM } from "@/lib/tmdb/episodes";

/**
 * One season's episodes, cached per show and season. Shared by the season API
 * route, the episode page and the episode OG card, so all three read one entry
 * rather than each paying for its own TMDB call.
 *
 * Null means the season does not exist. That is returned as a value rather than
 * thrown for two reasons. It is a stable fact, so caching it stops a wave of
 * made-up season URLs re-hitting TMDB. And an error thrown from inside a cached
 * function does not survive the cache boundary with its prototype: callers
 * received a plain Error carrying a digest, so `instanceof TmdbError` was false
 * and every bogus season rendered a card instead of a 404.
 *
 * Any other failure still throws, so a transient TMDB fault is never cached in
 * place of a real season.
 */
export async function seasonEpisodes(tvId: number, seasonNumber: number): Promise<EpisodeVM[] | null> {
  "use cache";
  cacheLife("days");
  cacheTag(`tv-season:${tvId}:${seasonNumber}`);
  try {
    return toEpisodes(await tmdb.season(tvId, seasonNumber));
  } catch (e) {
    // Checked here, inside the cached function, where the error still has its
    // real type. On the far side of the boundary it would not.
    if (e instanceof TmdbError && e.status === 404) return null;
    throw e;
  }
}

/** A single episode, or null when the season or the episode number is unknown. */
export async function oneEpisode(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<EpisodeVM | null> {
  const episodes = await seasonEpisodes(tvId, seasonNumber);
  return episodes?.find((e) => e.episodeNumber === episodeNumber) ?? null;
}
