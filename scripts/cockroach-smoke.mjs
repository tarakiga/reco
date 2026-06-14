import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false });

try {
  // Grab one stored embedding, then run the for-you-style cosine ANN query.
  const [seed] = await sql`SELECT title_id, embedding::text AS e FROM title_embeddings LIMIT 1`;
  const vec = seed.e; // already a "[...]" text literal
  const rows = await sql.unsafe(
    `SELECT t.title, t.media_type, 1 - (te.embedding <=> $1::vector) AS cos
     FROM title_embeddings te JOIN titles t ON t.id = te.title_id
     ORDER BY te.embedding <=> $1::vector LIMIT 5`,
    [vec],
  );
  console.log("cosine ANN top 5:");
  for (const r of rows) console.log(`  ${r.cos.toFixed(4)}  ${r.media_type.padEnd(5)} ${r.title}`);
  console.log("VECTOR QUERY OK");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
