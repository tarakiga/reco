// Create the cosine C-SPANN vector index on title_embeddings (CockroachDB v25.4+).
// Our queries (for-you, scene-search) already ORDER BY embedding <=> $vec LIMIT k,
// so cosine_ops is used automatically — no code or query changes needed.
// NOTE: the index backfill briefly blocks writes to title_embeddings; run off-peak.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 30 });
const ms = () => Number(process.hrtime.bigint() / 1000000n);

try {
  await sql.unsafe(`SET CLUSTER SETTING feature.vector_index.enabled = true`);
  await sql.unsafe(`SET sql_safe_updates = false`);

  const t = ms();
  await sql.unsafe(
    `CREATE VECTOR INDEX IF NOT EXISTS title_embeddings_cosine_idx
     ON title_embeddings (embedding vector_cosine_ops)
     WITH (min_partition_size = 16, max_partition_size = 128)`,
  );
  console.log(`create vector index: ${ms() - t}ms`);

  // Confirm the optimizer uses it for the real query shape.
  const [seed] = await sql`SELECT embedding::text AS e FROM title_embeddings LIMIT 1`;
  const plan = await sql.unsafe(
    `EXPLAIN SELECT title_id FROM title_embeddings ORDER BY embedding <=> $1::vector LIMIT 10`, [seed.e]);
  const planTxt = plan.map((x) => Object.values(x)[0]).join("\n");
  console.log("index used?", /cspann|cosine_idx|vector\s*index/i.test(planTxt) ? "YES" : "NO");
  console.log(planTxt.split("\n").slice(0, 6).join(" | "));
  console.log("DONE");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
