import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tags, titleTags, titles } from "@/db/schema";
import { getOrCreateTitle } from "./catalog";
import { slugify } from "@/lib/slug";
import { posterUrl } from "@/lib/tmdb/images";

export interface UserTag {
  id: string;
  name: string;
  slug: string;
}
export interface UserTagWithCount extends UserTag {
  count: number;
}

/** Tags the user has applied to one title. */
export async function getTitleTags(userId: string, titleId: string): Promise<UserTag[]> {
  return db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(titleTags)
    .innerJoin(tags, eq(tags.id, titleTags.tagId))
    .where(and(eq(tags.userId, userId), eq(titleTags.titleId, titleId)))
    .orderBy(asc(tags.name));
}

/** All of a user's tags, with how many titles each covers. */
export async function listUserTags(userId: string): Promise<UserTagWithCount[]> {
  return db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      count: sql<number>`count(${titleTags.titleId})::int`,
    })
    .from(tags)
    .leftJoin(titleTags, eq(titleTags.tagId, tags.id))
    .where(eq(tags.userId, userId))
    .groupBy(tags.id)
    .orderBy(asc(tags.name));
}

/** Apply a tag (creating it if new) to a title. */
export async function addTitleTag(
  userId: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
  name: string,
): Promise<UserTag | null> {
  const cleaned = name.trim();
  const slug = slugify(cleaned);
  if (!cleaned || !slug) return null;

  const title = await getOrCreateTitle(mediaType, tmdbId);

  let [tag] = await db
    .insert(tags)
    .values({ userId, name: cleaned, slug })
    .onConflictDoNothing()
    .returning({ id: tags.id, name: tags.name, slug: tags.slug });
  if (!tag) {
    [tag] = await db
      .select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.slug, slug)));
  }
  if (!tag) return null;

  await db.insert(titleTags).values({ tagId: tag.id, titleId: title.id }).onConflictDoNothing();
  return tag;
}

/** Remove a tag from a title (the tag itself stays). */
export async function removeTitleTag(
  userId: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
  tagId: string,
): Promise<boolean> {
  const [owned] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
  if (!owned) return false;
  const title = await getOrCreateTitle(mediaType, tmdbId);
  await db
    .delete(titleTags)
    .where(and(eq(titleTags.tagId, tagId), eq(titleTags.titleId, title.id)));
  return true;
}

/** Returns the new slug on success, or null (invalid, no-match, or slug clash). */
export async function renameTag(userId: string, tagId: string, name: string): Promise<string | null> {
  const cleaned = name.trim();
  const slug = slugify(cleaned);
  if (!cleaned || !slug) return null;
  try {
    const res = await db
      .update(tags)
      .set({ name: cleaned, slug })
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
      .returning({ slug: tags.slug });
    return res[0]?.slug ?? null;
  } catch {
    return null; // slug collides with another of the user's tags
  }
}

export async function deleteTag(userId: string, tagId: string): Promise<boolean> {
  const res = await db
    .delete(tags)
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
    .returning({ id: tags.id });
  return res.length > 0;
}

export interface TagCollectionItem {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
}
export interface TagCollection {
  name: string;
  slug: string;
  items: TagCollectionItem[];
}

/** Everything the user has tagged with a given tag (by slug). */
export async function getTagCollection(userId: string, slug: string): Promise<TagCollection | null> {
  const [tag] = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.slug, slug)));
  if (!tag) return null;

  const rows = await db
    .select({
      tmdbId: titles.tmdbId,
      mediaType: titles.mediaType,
      title: titles.title,
      year: titles.releaseYear,
      posterPath: titles.posterPath,
      slug: titles.slug,
    })
    .from(titleTags)
    .innerJoin(titles, eq(titles.id, titleTags.titleId))
    .where(eq(titleTags.tagId, tag.id))
    .orderBy(desc(titleTags.addedAt));

  return {
    name: tag.name,
    slug: tag.slug,
    items: rows.map((r) => ({
      mediaType: r.mediaType,
      tmdbId: r.tmdbId,
      title: r.title,
      year: r.year,
      posterUrl: posterUrl(r.posterPath),
      href: `/title/${r.mediaType}/${r.tmdbId}-${r.slug}`,
    })),
  };
}
