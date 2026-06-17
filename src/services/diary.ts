import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { diary, titles } from "@/db/schema";
import { getOrCreateTitle } from "./catalog";
import { posterUrl } from "@/lib/tmdb/images";

export interface DiaryEntry {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  /** YYYY-MM-DD */
  watchedOn: string;
}

export interface DiaryDate {
  id: string;
  watchedOn: string;
}

/** Log that the user watched a title on a date. Idempotent per (user, title, date). */
export async function addDiaryEntry(
  userId: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
  watchedOn: string,
): Promise<DiaryDate | null> {
  const title = await getOrCreateTitle(mediaType, tmdbId);
  const [row] = await db
    .insert(diary)
    .values({ userId, titleId: title.id, watchedOn })
    .onConflictDoNothing()
    .returning({ id: diary.id, watchedOn: diary.watchedOn });
  if (row) return row;
  const [existing] = await db
    .select({ id: diary.id, watchedOn: diary.watchedOn })
    .from(diary)
    .where(and(eq(diary.userId, userId), eq(diary.titleId, title.id), eq(diary.watchedOn, watchedOn)));
  return existing ?? null;
}

export async function removeDiaryEntry(userId: string, entryId: string): Promise<boolean> {
  const res = await db
    .delete(diary)
    .where(and(eq(diary.id, entryId), eq(diary.userId, userId)))
    .returning({ id: diary.id });
  return res.length > 0;
}

/** Dates the user logged for one title (for the detail-page "When?" widget). */
export async function titleDiaryDates(
  userId: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<DiaryDate[]> {
  const title = await getOrCreateTitle(mediaType, tmdbId);
  return db
    .select({ id: diary.id, watchedOn: diary.watchedOn })
    .from(diary)
    .where(and(eq(diary.userId, userId), eq(diary.titleId, title.id)))
    .orderBy(desc(diary.watchedOn));
}

/** The user's full diary, newest watch first. */
export async function listDiary(userId: string): Promise<DiaryEntry[]> {
  const rows = await db
    .select({
      id: diary.id,
      watchedOn: diary.watchedOn,
      tmdbId: titles.tmdbId,
      mediaType: titles.mediaType,
      title: titles.title,
      year: titles.releaseYear,
      posterPath: titles.posterPath,
      slug: titles.slug,
    })
    .from(diary)
    .innerJoin(titles, eq(titles.id, diary.titleId))
    .where(eq(diary.userId, userId))
    .orderBy(desc(diary.watchedOn), desc(diary.createdAt));
  return rows.map((r) => ({
    id: r.id,
    tmdbId: r.tmdbId,
    mediaType: r.mediaType,
    title: r.title,
    year: r.year,
    posterUrl: posterUrl(r.posterPath),
    href: `/title/${r.mediaType}/${r.tmdbId}-${r.slug}`,
    watchedOn: r.watchedOn,
  }));
}
