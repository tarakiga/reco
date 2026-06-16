import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { lists, listItems, titles, profiles } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { posterUrl } from "@/lib/tmdb/images";
import { pickTrailerKey } from "@/lib/tmdb/detail";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extract the leading UUID from a "<uuid>-<slug>" public list path segment. */
export function parseListId(idSlug: string): string | null {
  const id = idSlug.slice(0, 36);
  return UUID.test(id) ? id : null;
}

// ---------------------------------------------------------------------------
// Owner-side (management)
// ---------------------------------------------------------------------------

export interface ListSummary {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  published: boolean;
  itemCount: number;
  updatedAt: Date;
}

export async function listUserLists(userId: string): Promise<ListSummary[]> {
  return db
    .select({
      id: lists.id,
      title: lists.title,
      subtitle: lists.subtitle,
      slug: lists.slug,
      published: lists.published,
      updatedAt: lists.updatedAt,
      itemCount: sql<number>`count(${listItems.id})::int`,
    })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id))
    .where(eq(lists.userId, userId))
    .groupBy(lists.id)
    .orderBy(desc(lists.updatedAt));
}

export async function createList(
  userId: string,
  input: { title: string; subtitle?: string },
): Promise<{ id: string; slug: string }> {
  const [row] = await db
    .insert(lists)
    .values({
      userId,
      title: input.title,
      subtitle: input.subtitle ?? null,
      slug: slugify(input.title) || "list",
    })
    .returning({ id: lists.id, slug: lists.slug });
  return row;
}

export async function updateList(
  userId: string,
  listId: string,
  fields: { title?: string; subtitle?: string | null; published?: boolean },
): Promise<boolean> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.title !== undefined) {
    set.title = fields.title;
    set.slug = slugify(fields.title) || "list";
  }
  if (fields.subtitle !== undefined) set.subtitle = fields.subtitle;
  if (fields.published !== undefined) set.published = fields.published;
  const res = await db
    .update(lists)
    .set(set)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)))
    .returning({ id: lists.id });
  return res.length > 0;
}

export async function deleteList(userId: string, listId: string): Promise<boolean> {
  const res = await db
    .delete(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)))
    .returning({ id: lists.id });
  return res.length > 0;
}

async function ownsList(userId: string, listId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)));
  return Boolean(row);
}

async function touch(listId: string) {
  await db.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, listId));
}

export async function addListItem(userId: string, listId: string, titleId: string): Promise<boolean> {
  if (!(await ownsList(userId, listId))) return false;
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${listItems.position}), -1)::int` })
    .from(listItems)
    .where(eq(listItems.listId, listId));
  await db
    .insert(listItems)
    .values({ listId, titleId, position: (max ?? -1) + 1 })
    .onConflictDoNothing();
  await touch(listId);
  return true;
}

export async function removeListItem(userId: string, listId: string, titleId: string): Promise<boolean> {
  if (!(await ownsList(userId, listId))) return false;
  await db
    .delete(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.titleId, titleId)));
  await touch(listId);
  return true;
}

export async function reorderListItems(
  userId: string,
  listId: string,
  orderedTitleIds: string[],
): Promise<boolean> {
  if (!(await ownsList(userId, listId))) return false;
  for (let i = 0; i < orderedTitleIds.length; i++) {
    await db
      .update(listItems)
      .set({ position: i })
      .where(and(eq(listItems.listId, listId), eq(listItems.titleId, orderedTitleIds[i])));
  }
  await touch(listId);
  return true;
}

export interface OwnerListItem {
  titleId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  note: string | null;
}
export interface OwnerList {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  published: boolean;
  items: OwnerListItem[];
}

export async function getListForOwner(userId: string, listId: string): Promise<OwnerList | null> {
  const [l] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)));
  if (!l) return null;
  const rows = await db
    .select({
      titleId: titles.id,
      tmdbId: titles.tmdbId,
      mediaType: titles.mediaType,
      title: titles.title,
      year: titles.releaseYear,
      posterPath: titles.posterPath,
      slug: titles.slug,
      note: listItems.note,
    })
    .from(listItems)
    .innerJoin(titles, eq(titles.id, listItems.titleId))
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position));
  return {
    id: l.id,
    title: l.title,
    subtitle: l.subtitle,
    slug: l.slug,
    published: l.published,
    items: rows.map((r) => ({
      titleId: r.titleId,
      tmdbId: r.tmdbId,
      mediaType: r.mediaType,
      title: r.title,
      year: r.year,
      posterUrl: posterUrl(r.posterPath),
      href: `/title/${r.mediaType}/${r.tmdbId}-${r.slug}`,
      note: r.note ?? null,
    })),
  };
}

/** Set (or clear) the curator's note for one item. */
export async function setListItemNote(
  userId: string,
  listId: string,
  titleId: string,
  note: string | null,
): Promise<boolean> {
  if (!(await ownsList(userId, listId))) return false;
  await db
    .update(listItems)
    .set({ note: note && note.trim() ? note.trim() : null })
    .where(and(eq(listItems.listId, listId), eq(listItems.titleId, titleId)));
  await touch(listId);
  return true;
}

// ---------------------------------------------------------------------------
// Public view (rich cards)
// ---------------------------------------------------------------------------

export interface ViewListItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  genres: string[];
  overview: string | null;
  trailerKey: string | null;
  href: string;
  /** Curator's note for this item (shown at the foot of the card). */
  note: string | null;
  /** TMDB vote average (null when unrated). */
  rating: number | null;
  /** Movie runtime in minutes (null for TV). */
  runtime: number | null;
  /** TV season count (null for movies). */
  seasons: number | null;
}
export interface ViewList {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  author: string;
  items: ViewListItem[];
}

/** Public list (only when published). Used by the shared page + its OG image. */
export async function getListForView(listId: string): Promise<ViewList | null> {
  const [l] = await db
    .select({
      id: lists.id,
      title: lists.title,
      subtitle: lists.subtitle,
      slug: lists.slug,
      published: lists.published,
      author: profiles.username,
    })
    .from(lists)
    .innerJoin(profiles, eq(profiles.id, lists.userId))
    .where(eq(lists.id, listId));
  if (!l || !l.published) return null;

  const rows = await db
    .select({
      tmdbId: titles.tmdbId,
      mediaType: titles.mediaType,
      title: titles.title,
      year: titles.releaseYear,
      posterPath: titles.posterPath,
      overview: titles.overview,
      slug: titles.slug,
      metadata: titles.metadata,
      note: listItems.note,
    })
    .from(listItems)
    .innerJoin(titles, eq(titles.id, listItems.titleId))
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position));

  return {
    id: l.id,
    title: l.title,
    subtitle: l.subtitle,
    slug: l.slug,
    author: l.author,
    items: rows.map((r) => {
      const meta = (r.metadata ?? {}) as TmdbTitleDetail;
      return {
        tmdbId: r.tmdbId,
        mediaType: r.mediaType,
        title: r.title,
        year: r.year,
        posterUrl: posterUrl(r.posterPath),
        genres: (meta.genres ?? []).map((g) => g.name).slice(0, 3),
        overview: r.overview ?? meta.overview ?? null,
        trailerKey: pickTrailerKey(meta.videos?.results),
        href: `/title/${r.mediaType}/${r.tmdbId}-${r.slug}`,
        note: r.note ?? null,
        rating: meta.vote_average && meta.vote_average > 0 ? meta.vote_average : null,
        runtime: r.mediaType === "movie" ? meta.runtime ?? null : null,
        seasons: r.mediaType === "tv" ? meta.number_of_seasons ?? null : null,
      };
    }),
  };
}

/** Minimal list header for the OG image (published only). */
export async function getListMeta(
  listId: string,
): Promise<{ title: string; subtitle: string | null; author: string } | null> {
  const [l] = await db
    .select({
      title: lists.title,
      subtitle: lists.subtitle,
      published: lists.published,
      author: profiles.username,
    })
    .from(lists)
    .innerJoin(profiles, eq(profiles.id, lists.userId))
    .where(eq(lists.id, listId));
  if (!l || !l.published) return null;
  return { title: l.title, subtitle: l.subtitle, author: l.author };
}
