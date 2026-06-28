import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings, userTaste, ratings, watchlistItems, favourites } from "@/db/schema";
import { toVectorLiteral } from "@/db/vector";
import { nearestTitles } from "@/db/vector-search";
import { matchPercent } from "@/lib/taste/match";
import { titleSlug } from "@/lib/slug";
import { posterUrl } from "@/lib/tmdb/images";

export interface ForYouItem {
  titleId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  match: number;
}

const EXCLUDE_BUFFER = 5;

export async function forYou(userId: string, limit = 24, offset = 0): Promise<ForYouItem[]> {
  const [taste] = await db.select().from(userTaste).where(sql`${userTaste.userId} = ${userId}`);
  if (!taste) return [];
  const vec = toVectorLiteral(taste.embedding);

  // Titles the user already rated or watchlisted. Fetched separately (not as a
  // NOT IN subquery) so the vector query below can use the cosine index — a
  // join-table filter would force a full brute-force scan. Excluded in app code.
  const exResult = await db.execute(sql`
    SELECT title_id FROM ${ratings} WHERE user_id = ${userId}
    UNION
    SELECT title_id FROM ${watchlistItems} WHERE user_id = ${userId}
  `);
  const exRows = ((exResult as { rows?: Record<string, unknown>[] }).rows ?? exResult) as Record<string, unknown>[];
  const excluded = new Set(exRows.map((r) => r.title_id as string));

  // Over-fetch nearest neighbours so offset+limit still remain after excluding.
  const fetchLimit = offset + limit + excluded.size + EXCLUDE_BUFFER;
  const rows = (await nearestTitles(vec, fetchLimit))
    .filter((r) => !excluded.has(r.id))
    .slice(offset, offset + limit);

  return rows.map((r) => {
    const year = r.release_year;
    return {
      titleId: r.id,
      tmdbId: r.tmdb_id,
      mediaType: r.media_type,
      title: r.title,
      year,
      posterUrl: posterUrl(r.poster_path),
      href: `/title/${r.media_type}/${r.tmdb_id}-${titleSlug(r.title, year ? `${year}` : null)}`,
      match: matchPercent(r.cos),
    };
  });
}

export interface WhyReason {
  title: string;
  href: string;
}

/**
 * "Why this?" — for each recommended title, the user's most similar liked title
 * (high rating or favourite). One nearest-neighbour lookup per rec via a lateral
 * join over the user's liked set. Degrades to {} on any failure.
 */
export async function whyForTitles(
  userId: string,
  titleIds: string[],
): Promise<Record<string, WhyReason>> {
  if (titleIds.length === 0) return {};
  try {
    const likedRes = await db.execute(sql`
      SELECT title_id FROM ${ratings} WHERE user_id = ${userId} AND score >= 4
      UNION
      SELECT title_id FROM ${favourites} WHERE user_id = ${userId}
      LIMIT 60
    `);
    const likedRows = ((likedRes as { rows?: Record<string, unknown>[] }).rows ?? likedRes) as Record<string, unknown>[];
    const likedIds = likedRows.map((r) => r.title_id as string);
    if (likedIds.length === 0) return {};

    const recList = sql.join(titleIds.map((id) => sql`${id}`), sql`, `);
    const likedList = sql.join(likedIds.map((id) => sql`${id}`), sql`, `);
    const res = await db.execute(sql`
      WITH recs AS (
        SELECT title_id, embedding FROM ${titleEmbeddings} WHERE title_id IN (${recList})
      )
      SELECT recs.title_id AS rec_id, l.tmdb_id, l.media_type, l.title, l.slug
      FROM recs
      CROSS JOIN LATERAL (
        SELECT t.tmdb_id, t.media_type, t.title, t.slug
        FROM ${titleEmbeddings} te JOIN ${titles} t ON t.id = te.title_id
        WHERE te.title_id IN (${likedList})
        ORDER BY te.embedding <=> recs.embedding
        LIMIT 1
      ) l
    `);
    const rows = ((res as { rows?: Record<string, unknown>[] }).rows ?? res) as Record<string, unknown>[];
    const out: Record<string, WhyReason> = {};
    for (const r of rows) {
      const title = r.title as string;
      const mt = r.media_type as "movie" | "tv";
      const tmdbId = r.tmdb_id as number;
      const slug = (r.slug as string) || titleSlug(title, null);
      out[r.rec_id as string] = { title, href: `/title/${mt}/${tmdbId}-${slug}` };
    }
    return out;
  } catch {
    return {};
  }
}

/** Batch match% for specific titles (those that have embeddings). */
export async function matchForTitles(userId: string, titleIds: string[]): Promise<Record<string, number>> {
  if (titleIds.length === 0) return {};
  const [taste] = await db.select().from(userTaste).where(sql`${userTaste.userId} = ${userId}`);
  if (!taste) return {};
  const vec = toVectorLiteral(taste.embedding);
  const result = await db.execute(sql`
    SELECT title_id, 1 - (embedding <=> ${vec}::vector) AS cos
    FROM ${titleEmbeddings}
    WHERE title_id IN (${sql.join(titleIds.map((id) => sql`${id}`), sql`, `)})
  `);
  const rows = ((result as { rows?: Record<string, unknown>[] }).rows ?? result) as Record<string, unknown>[];
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.title_id as string] = matchPercent(r.cos as number);
  }
  return out;
}
