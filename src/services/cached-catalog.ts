import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { TitleRow, PersonRow } from "@/db/schema";
import { TmdbError } from "@/lib/tmdb/client";
import { getOrCreateTitle, getOrCreatePerson } from "./catalog";

/**
 * Cached, non-persisting catalog reads for public pages. The 404 check lives
 * INSIDE the cached function on purpose: an error thrown across a `"use cache"`
 * boundary loses its prototype, so callers could no longer tell a TmdbError
 * from anything else. A 404 is returned as `null` (and cached as such); every
 * other error is rethrown so a transient failure never fills the cache.
 */

export async function cachedTitle(
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<TitleRow | null> {
  "use cache";
  cacheLife("days");
  cacheTag(`title:${mediaType}:${tmdbId}`);
  try {
    return await getOrCreateTitle(mediaType, tmdbId, false);
  } catch (e) {
    if (e instanceof TmdbError && e.status === 404) return null;
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
    if (e instanceof TmdbError && e.status === 404) return null;
    throw e;
  }
}
