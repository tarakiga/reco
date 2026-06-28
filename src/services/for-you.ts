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

const rowsOf = (r: unknown) => ((r as { rows?: Record<string, unknown>[] }).rows ?? r) as Record<string, unknown>[];
const parseVec = (s: string): number[] => s.slice(1, -1).split(",").map(Number);
function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

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
 * (high rating or favourite). Both sets are small and bounded (≤60 liked, ≤24
 * recs), so we fetch each embedding once and pick the nearest liked title per
 * rec in app code. A CROSS JOIN LATERAL re-scans the whole liked set once per
 * rec and can't use the vector index. Degrades to {} on any failure.
 */
export async function whyForTitles(
  userId: string,
  titleIds: string[],
): Promise<Record<string, WhyReason>> {
  if (titleIds.length === 0) return {};
  try {
    const recList = sql.join(titleIds.map((id) => sql`${id}`), sql`, `);
    const [likedRes, recsRes] = await Promise.all([
      db.execute(sql`
        SELECT t.tmdb_id, t.media_type, t.title, t.slug, te.embedding::text AS emb
        FROM (
          SELECT title_id FROM ${ratings} WHERE user_id = ${userId} AND score >= 4
          UNION
          SELECT title_id FROM ${favourites} WHERE user_id = ${userId}
          LIMIT 60
        ) liked
        JOIN ${titles} t ON t.id = liked.title_id
        JOIN ${titleEmbeddings} te ON te.title_id = liked.title_id
      `),
      db.execute(sql`
        SELECT title_id, embedding::text AS emb FROM ${titleEmbeddings}
        WHERE title_id IN (${recList})
      `),
    ]);

    const liked = rowsOf(likedRes).map((r) => ({
      tmdbId: r.tmdb_id as number,
      mediaType: r.media_type as "movie" | "tv",
      title: r.title as string,
      slug: (r.slug as string) || "",
      emb: parseVec(r.emb as string),
    }));
    if (liked.length === 0) return {};
    const likedNorm = liked.map((l) => norm(l.emb) || 1);

    const out: Record<string, WhyReason> = {};
    for (const rec of rowsOf(recsRes)) {
      const recEmb = parseVec(rec.emb as string);
      const recNorm = norm(recEmb) || 1;
      let best = -Infinity;
      let bestIdx = -1;
      for (let i = 0; i < liked.length; i++) {
        const sim = dot(recEmb, liked[i].emb) / (recNorm * likedNorm[i]);
        if (sim > best) {
          best = sim;
          bestIdx = i;
        }
      }
      if (bestIdx < 0) continue;
      const l = liked[bestIdx];
      const slug = l.slug || titleSlug(l.title, null);
      out[rec.title_id as string] = { title: l.title, href: `/title/${l.mediaType}/${l.tmdbId}-${slug}` };
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
