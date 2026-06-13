import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, ratings, titles, watchlistItems } from "@/db/schema";

export type WatchStatus = "want_to_watch" | "watching" | "watched";

export async function setWatchStatus(userId: string, titleId: string, status: WatchStatus) {
  await db
    .insert(watchlistItems)
    .values({ userId, titleId, status, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [watchlistItems.userId, watchlistItems.titleId],
      set: { status, updatedAt: new Date() },
    });
}

export async function removeFromWatchlist(userId: string, titleId: string) {
  await db
    .delete(watchlistItems)
    .where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.titleId, titleId)));
}

export async function setRating(userId: string, titleId: string, score: number) {
  await db
    .insert(ratings)
    .values({ userId, titleId, score, ratedAt: new Date() })
    .onConflictDoUpdate({
      target: [ratings.userId, ratings.titleId],
      set: { score, ratedAt: new Date() },
    });
}

export async function removeRating(userId: string, titleId: string) {
  await db.delete(ratings).where(and(eq(ratings.userId, userId), eq(ratings.titleId, titleId)));
}

export interface WatchlistEntry {
  titleId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  slug: string;
  title: string;
  releaseYear: number | null;
  posterPath: string | null;
  status: WatchStatus;
}

export async function listWatchlist(userId: string): Promise<WatchlistEntry[]> {
  const rows = await db
    .select({
      titleId: titles.id,
      tmdbId: titles.tmdbId,
      mediaType: titles.mediaType,
      slug: titles.slug,
      title: titles.title,
      releaseYear: titles.releaseYear,
      posterPath: titles.posterPath,
      status: watchlistItems.status,
    })
    .from(watchlistItems)
    .innerJoin(titles, eq(watchlistItems.titleId, titles.id))
    .where(eq(watchlistItems.userId, userId))
    .orderBy(desc(watchlistItems.updatedAt));
  return rows;
}

export async function updateRegion(userId: string, region: string) {
  await db.update(profiles).set({ region }).where(eq(profiles.id, userId));
}

export async function getTitleState(
  userId: string,
  titleId: string,
): Promise<{ status: WatchStatus | null; score: number | null }> {
  const [w] = await db
    .select({ status: watchlistItems.status })
    .from(watchlistItems)
    .where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.titleId, titleId)));
  const [r] = await db
    .select({ score: ratings.score })
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.titleId, titleId)));
  return { status: w?.status ?? null, score: r?.score ?? null };
}
