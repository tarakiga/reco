import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { TitleRow, PersonRow } from "@/db/schema";
import { TmdbError } from "@/lib/tmdb/client";
import { getOrCreateTitle, getOrCreatePerson, STALE_MS } from "./catalog";

/**
 * Cached, non-persisting catalog reads for public pages. The 404 check lives
 * INSIDE the cached function on purpose: an error thrown across a `"use cache"`
 * boundary loses its prototype, so callers could no longer tell a TmdbError
 * from anything else. A 404 is returned as `null` and cached for hours only, so
 * a title or person TMDB adds later shows up the same day; every other error is
 * rethrown so a transient failure never fills the cache.
 */

/**
 * True when the row is a degraded read: the minimal fallback built during a
 * TMDB outage (refreshedAt at epoch) or a stale catalog row reused because the
 * full fetch failed. Such a row lacks cast, trailer, seasons and the like, so
 * it must not be pinned for days. Called inside `"use cache"`, where reading
 * the clock is allowed.
 */
function isDegraded(refreshedAt: Date | string): boolean {
  const at = new Date(refreshedAt).getTime();
  return at === 0 || Date.now() - at >= STALE_MS;
}

export async function cachedTitle(
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<TitleRow | null> {
  "use cache";
  cacheLife("days");
  cacheTag(`title:${mediaType}:${tmdbId}`);
  try {
    const row = await getOrCreateTitle(mediaType, tmdbId, false);
    // cacheLife keeps the shortest profile when called more than once.
    if (isDegraded(row.refreshedAt)) cacheLife("hours");
    return row;
  } catch (e) {
    if (e instanceof TmdbError && e.status === 404) {
      cacheLife("hours");
      return null;
    }
    throw e;
  }
}

export async function cachedPerson(tmdbId: number): Promise<PersonRow | null> {
  "use cache";
  cacheLife("days");
  cacheTag(`person:${tmdbId}`);
  try {
    return await getOrCreatePerson(tmdbId, false);
  } catch (e) {
    if (e instanceof TmdbError && e.status === 404) {
      cacheLife("hours");
      return null;
    }
    throw e;
  }
}
