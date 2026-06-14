import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

// Load env explicitly from the project root (independent of cwd).
const root = new URL("..", import.meta.url);
const readEnv = (file) => {
  try {
    return Object.fromEntries(
      readFileSync(new URL(file, root), "utf8")
        .split("\n")
        .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]),
    );
  } catch {
    return {};
  }
};
const env = { ...readEnv(".env"), ...readEnv(".env.local") };
const sql = neon(env.DATABASE_URL);
const SECRET = env.CRON_SECRET;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const counts = async () =>
  (await sql`select (select count(*) from titles)::int t,(select count(*) from title_embeddings)::int e`)[0];

let total = 0;
let zeros = 0;
for (let i = 0; i < 120; i++) {
  const c = await counts();
  if (c.e >= c.t) {
    console.log(`DONE: ${c.e}/${c.t} embedded`);
    break;
  }
  let written = 0;
  try {
    const r = await fetch("http://localhost:3000/api/v1/admin/embed-missing?limit=100", {
      headers: { authorization: `Bearer ${SECRET}` },
      signal: AbortSignal.timeout(120000),
    });
    if (r.ok) written = (await r.json()).written ?? 0;
    else console.log("http", r.status);
  } catch (e) {
    console.log("err", e.message);
  }
  total += written;
  console.log(`iter ${i + 1}: +${written} (total ${total}) [${c.e}/${c.t}]`);
  if (written === 0) {
    if (++zeros >= 6) {
      console.log("6 empty iterations, stopping");
      break;
    }
    await sleep(15000);
  } else {
    zeros = 0;
    await sleep(5000);
  }
}
console.log("FINAL:", await counts());
