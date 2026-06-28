import { sql, env } from "./_db.mjs";

const SECRET = env.CRON_SECRET;
const size = async () => (await sql`select pg_size_pretty(pg_database_size(current_database())) s`)[0].s;

console.log("start:", await size());

// 1. Instantly free the embeddings file (nothing references it; we re-embed after).
await sql`TRUNCATE title_embeddings`;
console.log("after TRUNCATE embeddings:", await size());

// 2. Re-slim every title (now safe — we have headroom from the truncate).
let after = "";
let total = 0;
for (let i = 0; i < 200; i++) {
  const u = `http://localhost:3000/api/v1/admin/reslim?limit=400${after ? `&after=${after}` : ""}`;
  const r = await fetch(u, { headers: { authorization: `Bearer ${SECRET}` } });
  if (!r.ok) {
    console.error("reslim failed:", r.status, await r.text());
    break;
  }
  const { processed, lastId } = await r.json();
  total += processed;
  if (processed < 400 || !lastId) break;
  after = lastId;
}
console.log(`re-slimmed ${total} titles`);

// 3. Compact the titles file for real (live data is small now → fits).
await sql`VACUUM FULL titles`;
console.log("after VACUUM FULL titles:", await size());

await sql`VACUUM FULL title_embeddings`;
console.log("final:", await size());
await sql.end();
