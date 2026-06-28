import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings } from "@/db/schema";

export interface NearTitleRow {
  id: string;
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  release_year: number | null;
  poster_path: string | null;
  /** Cosine similarity in [0,1] (1 - cosine distance). */
  cos: number;
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  return ((result as { rows?: Record<string, unknown>[] }).rows ?? result) as Record<string, unknown>[];
}

/**
 * The K nearest titles to a query vector, ascending by cosine distance.
 *
 * Done in two steps ON PURPOSE. The ANN ordering runs over title_embeddings
 * ALONE so the cosine index (title_embeddings_cosine_idx) is used. Joining the
 * titles table into that same ORDER BY ... LIMIT statement makes CockroachDB's
 * optimizer fall back to a FULL SCAN of both tables + hash join (~47k rows /
 * ~600 MB read per call) — confirmed via EXPLAIN. We then hydrate only the K
 * winners by primary key, which stays a bounded lookup.
 */
export async function nearestTitles(vec: string, limit: number): Promise<NearTitleRow[]> {
  // Step 1 — index-accelerated nearest neighbours (ids only, in distance order).
  const nnRes = await db.execute(sql`
    SELECT title_id
    FROM ${titleEmbeddings}
    ORDER BY embedding <=> ${vec}::vector
    LIMIT ${limit}
  `);
  const ids = rowsOf(nnRes).map((r) => r.title_id as string);
  if (ids.length === 0) return [];
  const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);

  // Step 2 — hydrate just those K titles by PK and recompute the distance for
  // them (a bounded join over K rows, not the whole table).
  const hydRes = await db.execute(sql`
    SELECT t.id, t.tmdb_id, t.media_type, t.title, t.release_year, t.poster_path,
           1 - (te.embedding <=> ${vec}::vector) AS cos
    FROM ${titles} t
    JOIN ${titleEmbeddings} te ON te.title_id = t.id
    WHERE t.id IN (${idList})
  `);
  const byId = new Map(rowsOf(hydRes).map((r) => [r.id as string, r]));

  // Re-assemble in the step-1 distance order (the IN() hydrate is unordered).
  const out: NearTitleRow[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) continue;
    out.push({
      id,
      tmdb_id: r.tmdb_id as number,
      media_type: r.media_type as "movie" | "tv",
      title: r.title as string,
      release_year: (r.release_year as number | null) ?? null,
      poster_path: (r.poster_path as string | null) ?? null,
      cos: r.cos as number,
    });
  }
  return out;
}
