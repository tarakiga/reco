import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings, userTaste, ratings, watchlistItems } from "@/db/schema";
import { toVectorLiteral } from "@/db/vector";
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
  // cosine similarity = 1 - cosine distance (<=>); ORDER BY <=> LIMIT uses the index.
  const fetchLimit = offset + limit + excluded.size + EXCLUDE_BUFFER;
  const result = await db.execute(sql`
    SELECT t.id, t.tmdb_id, t.media_type, t.title, t.release_year, t.poster_path,
           1 - (te.embedding <=> ${vec}::vector) AS cos
    FROM ${titleEmbeddings} te
    JOIN ${titles} t ON t.id = te.title_id
    ORDER BY te.embedding <=> ${vec}::vector
    LIMIT ${fetchLimit}
  `);

  const rows = (((result as { rows?: Record<string, unknown>[] }).rows ?? result) as Record<string, unknown>[])
    .filter((r) => !excluded.has(r.id as string))
    .slice(offset, offset + limit);

  return rows.map((r) => {
    const title = r.title as string;
    const year = (r.release_year as number | null) ?? null;
    const mediaType = r.media_type as "movie" | "tv";
    const tmdbId = r.tmdb_id as number;
    return {
      titleId: r.id as string,
      tmdbId,
      mediaType,
      title,
      year,
      posterUrl: posterUrl(r.poster_path as string | null),
      href: `/title/${mediaType}/${tmdbId}-${titleSlug(title, year ? `${year}` : null)}`,
      match: matchPercent(r.cos as number),
    };
  });
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
