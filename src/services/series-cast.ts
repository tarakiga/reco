import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { aggregateCast, type CastEntry } from "@/lib/tmdb/detail";

/**
 * Full-series cast for a TV show from aggregate_credits — so regulars who left
 * before the final season (e.g. Jill Marie Jones on Girlfriends) still appear,
 * unlike `credits` which only lists the current/last-season cast. Cached per
 * show; [] on error so the caller can fall back to `credits`.
 */
export async function seriesCast(tvId: number): Promise<CastEntry[]> {
  "use cache";
  // Hours, not days: TMDB cast edits (new credits, episode counts) should surface
  // the same day. The `v2` tag also re-keys this cache on deploy, picking up the
  // episode-count-first ranking in aggregateCast.
  cacheLife("hours");
  cacheTag(`series-cast:v2:${tvId}`);
  try {
    const agg = await tmdb.tvAggregateCredits(tvId);
    return aggregateCast(agg.cast, 18);
  } catch {
    return [];
  }
}
