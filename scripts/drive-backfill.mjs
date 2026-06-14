// Drive the production catalog backfill toward ~20k titles. Hits the deployed
// backfill-catalog route in small page chunks (so the mirror+embed work runs in
// Vercel next to the DB), paced for Voyage rate limits, stopping at TARGET.
// Idempotent: getOrCreateTitle + embedTitles skip existing/unchanged.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const parse = (s) => Object.fromEntries(s.split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]));
const env = parse(readFileSync(new URL("../.env.local", import.meta.url), "utf8"));

const BASE = process.env.BACKFILL_BASE || "https://reco-pink.vercel.app";
const SECRET = env.CRON_SECRET;
const TARGET = Number(process.env.BACKFILL_TARGET || 20000);
const CHUNK = 5;          // TMDB pages per call (~100 titles)
const PACE_MS = 4000;     // gap between calls (Voyage pacing)
const sql = postgres(env.COCKROACH_URL, { max: 1, prepare: false, connect_timeout: 30 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const count = async () => (await sql`SELECT count(*)::int n FROM titles`)[0].n;
const stamp = () => new Date().toISOString().slice(11, 19);

(async () => {
  let total = await count();
  console.log(`${stamp()} START titles=${total} target=${TARGET}`);
  let stop = false;
  for (const type of ["movie", "tv"]) {
    if (stop) break;
    for (let from = 1; from <= 500; from += CHUNK) {
      const to = Math.min(500, from + CHUNK - 1);
      try {
        const res = await fetch(`${BASE}/api/v1/admin/backfill-catalog?type=${type}&from=${from}&to=${to}`, { headers: { authorization: `Bearer ${SECRET}` } });
        const body = res.ok ? await res.json() : { error: res.status };
        total = await count();
        console.log(`${stamp()} ${type} ${from}-${to} ${JSON.stringify(body)} titles=${total}`);
        if (!res.ok) await sleep(PACE_MS * 3); // back off on error (likely Voyage 429)
      } catch (e) {
        console.log(`${stamp()} ${type} ${from}-${to} ERR ${e.message}`);
        await sleep(PACE_MS * 3);
      }
      if (total >= TARGET) { console.log(`${stamp()} REACHED TARGET ${total}`); stop = true; break; }
      await sleep(PACE_MS);
    }
  }
  console.log(`${stamp()} DONE titles=${total}`);
  await sql.end();
})();
