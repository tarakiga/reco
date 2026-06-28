import { sql, env } from "./_db.mjs";

const SECRET = env.CRON_SECRET;
const BASE = "http://localhost:3000/api/v1/admin/reslim";
const LIMIT = 250;

const size = async () =>
  (await sql`select pg_size_pretty(pg_database_size(current_database())) s`)[0].s;

console.log("BEFORE:", await size());

let after = "";
let total = 0;
for (let i = 0; i < 200; i++) {
  const u = `${BASE}?limit=${LIMIT}${after ? `&after=${after}` : ""}`;
  const res = await fetch(u, { headers: { authorization: `Bearer ${SECRET}` } });
  if (!res.ok) {
    console.error("route failed:", res.status, await res.text());
    break;
  }
  const { processed, lastId } = await res.json();
  total += processed;
  await sql`VACUUM titles`; // reclaim dead tuples each batch so we stay under the cap
  console.log(`batch ${i + 1}: re-slimmed ${processed} (total ${total})`);
  if (processed < LIMIT || !lastId) break;
  after = lastId;
}

console.log("AFTER:", await size(), "| re-slimmed", total, "titles");
await sql.end();
