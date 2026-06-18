import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { titles, people, type TitleRow, type PersonRow } from "@/db/schema";
import { tmdb } from "@/lib/tmdb/client";
import { slimTitleMetadata, slimPersonMetadata } from "@/lib/tmdb/slim";
import { titleSlug, slugify } from "@/lib/slug";

const STALE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isFresh(refreshedAt: Date): boolean {
  return Date.now() - new Date(refreshedAt).getTime() < STALE_MS;
}

/**
 * Get a title, mirroring it from TMDB on miss. `persist` (default true) writes
 * it to the catalog; pass `false` for anonymous page renders so a crawler
 * walking /title/[id] by sequential id can't grow the DB. Non-persisted rows
 * carry an empty `id` (fine for render — only signed-in features use it).
 */
export async function getOrCreateTitle(
  mediaType: "movie" | "tv",
  tmdbId: number,
  persist = true,
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
  // Never persist anonymous renders, and never persist adult titles (so a stray
  // adult parody can't re-enter the catalog via a view or backfill).
  if (!persist || (data as { adult?: boolean }).adult) return { id: existing?.id ?? "", ...values } as TitleRow;

  const [row] = await db
    .insert(titles)
    .values(values)
    .onConflictDoUpdate({ target: [titles.tmdbId, titles.mediaType], set: values })
    .returning();
  return row;
}

export async function getOrCreatePerson(tmdbId: number, persist = true): Promise<PersonRow> {
  const [existing] = await db.select().from(people).where(eq(people.tmdbId, tmdbId));
  if (existing && isFresh(existing.refreshedAt)) return existing;

  const data = await tmdb.getPerson(tmdbId);
  const values = {
    tmdbId,
    slug: slugify(data.name),
    name: data.name,
    profilePath: data.profile_path ?? null,
    metadata: slimPersonMetadata(data),
    refreshedAt: new Date(),
  };
  if (!persist) return { id: existing?.id ?? "", ...values } as PersonRow;

  const [row] = await db
    .insert(people)
    .values(values)
    .onConflictDoUpdate({ target: people.tmdbId, set: values })
    .returning();
  return row;
}
