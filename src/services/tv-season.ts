import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { toEpisodes, type EpisodeVM } from "@/lib/tmdb/episodes";

/**
 * One season's episodes, cached per show and season. Shared by the season API
 * route, the episode page and the episode OG card, so all three read one entry
 * rather than each paying for its own TMDB call.
 *
 * A failed fetch throws rather than returning empty, so a transient TMDB error
 * is never cached in place of a real season.
 */
export async function seasonEpisodes(tvId: number, seasonNumber: number): Promise<EpisodeVM[]> {
  "use cache";
  cacheLife("days");
  cacheTag(`tv-season:${tvId}:${seasonNumber}`);
  return toEpisodes(await tmdb.season(tvId, seasonNumber));
}

/** A single episode, or null when the season has no such episode number. */
export async function oneEpisode(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<EpisodeVM | null> {
  const episodes = await seasonEpisodes(tvId, seasonNumber);
  return episodes.find((e) => e.episodeNumber === episodeNumber) ?? null;
}
