import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { titles, people, type TitleRow, type PersonRow } from "@/db/schema";
import { tmdb } from "@/lib/tmdb/client";
import { slimTitleMetadata } from "@/lib/tmdb/slim";
import { titleSlug, slugify } from "@/lib/slug";

const STALE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isFresh(refreshedAt: Date): boolean {
  return Date.now() - new Date(refreshedAt).getTime() < STALE_MS;
}

export async function getOrCreateTitle(
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<TitleRow> {
  const [existing] = await db
    .select()
    .from(titles)
    .where(and(eq(titles.tmdbId, tmdbId), eq(titles.mediaType, mediaType)));
  if (existing && isFresh(existing.refreshedAt)) return existing;

  const data = await tmdb.getTitle(mediaType, tmdbId);
  const name = data.title ?? data.name ?? "Untitled";
  const date = data.release_date ?? data.first_air_date ?? null;
  const year = date && date.length >= 4 ? Number(date.slice(0, 4)) : null;
  const values = {
    tmdbId,
    mediaType,
    slug: titleSlug(name, date),
    title: name,
    releaseYear: Number.isFinite(year) ? year : null,
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    overview: data.overview ?? null,
    metadata: slimTitleMetadata(data),
    refreshedAt: new Date(),
  };
  const [row] = await db
    .insert(titles)
    .values(values)
    .onConflictDoUpdate({ target: [titles.tmdbId, titles.mediaType], set: values })
    .returning();
  return row;
}

export async function getOrCreatePerson(tmdbId: number): Promise<PersonRow> {
  const [existing] = await db.select().from(people).where(eq(people.tmdbId, tmdbId));
  if (existing && isFresh(existing.refreshedAt)) return existing;

  const data = await tmdb.getPerson(tmdbId);
  const values = {
    tmdbId,
    slug: slugify(data.name),
    name: data.name,
    profilePath: data.profile_path ?? null,
    metadata: data,
    refreshedAt: new Date(),
  };
  const [row] = await db
    .insert(people)
    .values(values)
    .onConflictDoUpdate({ target: people.tmdbId, set: values })
    .returning();
  return row;
}
