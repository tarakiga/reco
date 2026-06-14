import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false });
const t = [
  "profiles", "titles", "people", "config_options", "content_blocks",
  "config_versions", "audit_log", "title_embeddings", "user_taste",
  "watchlist_items", "ratings", "favourites",
];
try {
  for (const name of t) {
    const r = await sql.unsafe(`SELECT count(*)::int n FROM ${name}`);
    console.log(name.padEnd(18), r[0].n);
  }
} catch (e) {
  console.error("ERROR:", e.message);
} finally {
  await sql.end();
}
