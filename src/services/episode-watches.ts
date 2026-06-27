import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { episodeWatches } from "@/db/schema";
import { getOrCreateTitle } from "./catalog";

export interface WatchedEpisode {
  season: number;
  episode: number;
}

export async function getWatchedEpisodes(userId: string, tmdbId: number): Promise<WatchedEpisode[]> {
  const title = await getOrCreateTitle("tv", tmdbId);
  const rows = await db
    .select({ season: episodeWatches.seasonNumber, episode: episodeWatches.episodeNumber })
    .from(episodeWatches)
    .where(and(eq(episodeWatches.userId, userId), eq(episodeWatches.titleId, title.id)));
  // CockroachDB INT8 columns can arrive as strings via postgres.js.
  return rows.map((r) => ({ season: Number(r.season), episode: Number(r.episode) }));
}

export async function setEpisodeWatched(
  userId: string,
  tmdbId: number,
  season: number,
  episode: number,
  watched: boolean,
): Promise<void> {
  const title = await getOrCreateTitle("tv", tmdbId);
  if (watched) {
    await db
      .insert(episodeWatches)
      .values({ userId, titleId: title.id, seasonNumber: season, episodeNumber: episode })
      .onConflictDoNothing();
  } else {
    await db
      .delete(episodeWatches)
      .where(
        and(
          eq(episodeWatches.userId, userId),
          eq(episodeWatches.titleId, title.id),
          eq(episodeWatches.seasonNumber, season),
          eq(episodeWatches.episodeNumber, episode),
        ),
      );
  }
}

/** Mark (or clear) a whole season's episodes at once. */
export async function setSeasonWatched(
  userId: string,
  tmdbId: number,
  season: number,
  episodes: number[],
  watched: boolean,
): Promise<void> {
  const title = await getOrCreateTitle("tv", tmdbId);
  if (watched) {
    if (episodes.length === 0) return;
    await db
      .insert(episodeWatches)
      .values(episodes.map((e) => ({ userId, titleId: title.id, seasonNumber: season, episodeNumber: e })))
      .onConflictDoNothing();
  } else {
    await db
      .delete(episodeWatches)
      .where(
        and(eq(episodeWatches.userId, userId), eq(episodeWatches.titleId, title.id), eq(episodeWatches.seasonNumber, season)),
      );
  }
}
