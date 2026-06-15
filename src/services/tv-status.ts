import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { statusBadge, type StatusBadge } from "@/lib/tv-status";

/** TMDB production status for one show ("Ended", "Canceled", "Returning Series").
 *  Cached ~daily per show (shared across users), so it's roughly one call per
 *  show per day site-wide. Null on error. */
async function tvStatus(tvId: number): Promise<string | null> {
  "use cache";
  cacheLife("days");
  cacheTag(`tv-status:${tvId}`);
  try {
    return (await tmdb.tvAiring(tvId)).status ?? null;
  } catch {
    return null;
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
        const b = statusBadge(await tvStatus(i.tmdbId));
        if (b) map.set(i.tmdbId, b);
      }),
  );
  return map;
}
