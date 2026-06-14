import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const KEEP_POPULAR = 4000;

const fmt = (r) => `${r.s} · titles ${r.t} · embeddings ${r.e}`;
const stat = async () =>
  (
    await sql`select pg_size_pretty(pg_database_size(current_database())) s,
                    (select count(*) from titles)::int t,
                    (select count(*) from title_embeddings)::int e`
  )[0];

console.log("BEFORE:", fmt(await stat()));

// Keep: every title a user has touched + the most popular N (by TMDB vote_count).
// Deleting a title cascades to its embedding (and would cascade user rows — which
// is why user-referenced titles are explicitly preserved).
await sql`
  DELETE FROM titles t
  WHERE t.id NOT IN (SELECT title_id FROM ratings
                     UNION SELECT title_id FROM watchlist_items
                     UNION SELECT title_id FROM favourites)
    AND t.id NOT IN (
      SELECT id FROM titles
      ORDER BY COALESCE((metadata->>'vote_count')::numeric, 0) DESC
      LIMIT ${KEEP_POPULAR}
    )
`;
console.log("deleted excess titles (+ cascaded embeddings)");

// Plain VACUUM: marks freed pages reusable so new inserts don't need to extend
// the file (no exclusive lock, no extra space needed — safe near the limit).
await sql`VACUUM (ANALYZE) title_embeddings`;
await sql`VACUUM (ANALYZE) titles`;
console.log("vacuumed");

console.log("AFTER:", fmt(await stat()));
