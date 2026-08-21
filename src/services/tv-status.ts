import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { statusBadge, type StatusBadge, type TvAiringInfo } from "@/lib/tv-status";

const NULL_INFO: TvAiringInfo = { status: null, nextEpisode: null, lastAirDate: null };

async function airingInfoCached(tvId: number): Promise<TvAiringInfo> {
  "use cache";
  cacheLife("days");
  cacheTag(`tv-status:${tvId}`);
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
}

/** Never throws. The catch sits OUTSIDE the cache boundary on purpose: a
 *  rejected cached call does not fill the entry, so a transient TMDB blip is
 *  retried on the next request instead of silencing the banner and every card
 *  badge for a whole day. The catch is prototype-free, so the lesson about
 *  errors losing their class across the boundary does not bite here. */
export async function tvAiringInfo(tvId: number): Promise<TvAiringInfo> {
  try {
    return await airingInfoCached(tvId);
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
