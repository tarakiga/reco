// Verify the real app query shapes (scene-search, for-you) against the cosine
// index: does the optimizer use it, and do filtered variants still return a full set?
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 30 });
const used = (txt) => (/cspann|cosine_idx|vector\s*index/i.test(txt) ? "INDEX" : "scan");
const ms = () => Number(process.hrtime.bigint() / 1000000n);

const explain = async (q, params) => (await sql.unsafe(`EXPLAIN ${q}`, params)).map((x) => Object.values(x)[0]).join("\n");
const timed = async (q, params) => { const t = ms(); const r = await sql.unsafe(q, params); return [r, ms() - t]; };

try {
  const [seed] = await sql`SELECT embedding::text AS e FROM title_embeddings LIMIT 1`;
  const v = seed.e;
  const [{ id: userId }] = await sql`SELECT id FROM profiles LIMIT 1`;

  const SCENE = `SELECT t.id FROM title_embeddings te JOIN titles t ON t.id = te.title_id
                 ORDER BY te.embedding <=> $1::vector LIMIT 24`;
  const SCENE_MOVIE = `SELECT t.id FROM title_embeddings te JOIN titles t ON t.id = te.title_id
                 WHERE t.media_type = 'movie' ORDER BY te.embedding <=> $1::vector LIMIT 24`;
  const FORYOU = `SELECT t.id FROM title_embeddings te JOIN titles t ON t.id = te.title_id
                 WHERE t.id NOT IN (SELECT title_id FROM ratings WHERE user_id = $2
                                    UNION SELECT title_id FROM watchlist_items WHERE user_id = $2)
                 ORDER BY te.embedding <=> $1::vector LIMIT 24`;

  for (const [name, q, params] of [
    ["scene (no filter)", SCENE, [v]],
    ["scene (media=movie)", SCENE_MOVIE, [v]],
    ["for-you (exclusions)", FORYOU, [v, userId]],
  ]) {
    const plan = await explain(q, params);
    const [rows, t] = await timed(q, params);
    console.log(`${name.padEnd(22)} ${used(plan).padEnd(6)} rows=${rows.length}/24  ${t}ms`);
  }
  console.log("DONE");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
