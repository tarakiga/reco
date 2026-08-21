import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { statusBadge, type StatusBadge, type TvAiringInfo } from "@/lib/tv-status";

const NULL_INFO: TvAiringInfo = { status: null, nextEpisode: null, lastAirDate: null };

/** Status, next scheduled episode and last air date for one show, from the one
 *  tvAiring call this service already made and cached daily. The banner and the
 *  card badge both read this entry, so widening it added no TMDB volume. Errors
 *  return the all-null shape: liveness is decoration, never a page break. */
export async function tvAiringInfo(tvId: number): Promise<TvAiringInfo> {
  "use cache";
  cacheLife("days");
  cacheTag(`tv-status:${tvId}`);
  try {
    const d = await tmdb.tvAiring(tvId);
    const n = d.next_episode_to_air;
    return {
      status: d.status ?? null,
      lastAirDate: d.last_air_date ?? null,
      nextEpisode: n
        ? {
            seasonNumber: n.season_number ?? 0,
            episodeNumber: n.episode_number ?? 0,
            name: n.name ?? null,
            airDate: n.air_date ?? null,
          }
        : null,
    };
  } catch {
    return NULL_INFO;
  }
}

/**
 * Terminal-status badges for the TV items in a result set, keyed by tmdbId.
 * Only TV items are fetched; only Ended/Cancelled produce an entry (movies and
 * healthy returning shows are absent → no badge).
 */
export async function tvStatusBadges(
  items: { mediaType: "movie" | "tv"; tmdbId: number }[],
): Promise<Map<number, StatusBadge>> {
  const map = new Map<number, StatusBadge>();
  await Promise.all(
    items
      .filter((i) => i.mediaType === "tv")
      .map(async (i) => {
        const b = statusBadge((await tvAiringInfo(i.tmdbId)).status);
        if (b) map.set(i.tmdbId, b);
      }),
  );
  return map;
}
