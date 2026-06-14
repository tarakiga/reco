import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings } from "@/db/schema";
import { toVectorLiteral } from "@/db/vector";
import { matchPercent } from "@/lib/taste/match";
import { titleSlug } from "@/lib/slug";
import { posterUrl } from "@/lib/tmdb/images";
import { defaultEmbedder, type Embedder } from "@/lib/taste/embedder";

export interface SceneResult {
  titleId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  match: number;
}

const MIN_WORDS = 3;
const MIN_SIMILARITY = 0.15; // drop near-random matches so nonsense → "nothing matched"
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 40;

/**
 * Semantic "search by scene": embed the description as a query vector and return
 * the nearest titles by cosine similarity. `embedder` is injectable for tests.
 */
export async function searchByScene(
  query: string,
  opts: { limit?: number; mediaType?: "movie" | "tv" } = {},
  embedder: Embedder = defaultEmbedder(),
): Promise<SceneResult[]> {
  const q = query.trim();
  if (q.split(/\s+/).filter(Boolean).length < MIN_WORDS) return [];

  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  let qvec: number[];
  try {
    [qvec] = await embedder.embed([q], "query");
  } catch {
    return []; // embedding provider failure → graceful empty
  }
  const vec = toVectorLiteral(qvec);
  const mediaFilter = opts.mediaType ? sql`AND t.media_type = ${opts.mediaType}` : sql``;

  const result = await db.execute(sql`
    SELECT t.id, t.tmdb_id, t.media_type, t.title, t.release_year, t.poster_path,
           1 - (te.embedding <=> ${vec}::vector) AS cos
    FROM ${titleEmbeddings} te
    JOIN ${titles} t ON t.id = te.title_id
    WHERE 1 = 1 ${mediaFilter}
    ORDER BY te.embedding <=> ${vec}::vector
    LIMIT ${limit}
  `);
  const rows = ((result as { rows?: Record<string, unknown>[] }).rows ?? result) as Record<string, unknown>[];

  return rows
    .filter((r) => (r.cos as number) >= MIN_SIMILARITY)
    .map((r) => {
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
