// Additive migration: per-episode watched markers for TV series progress.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) {
  console.error("COCKROACH_URL not found in .env.local");
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false });

await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS episode_watches (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    season_number INT NOT NULL,
    episode_number INT NOT NULL,
    watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, title_id, season_number, episode_number)
  );
`);

const [{ count }] = await sql`SELECT count(*)::int AS count FROM episode_watches`;
console.log(`OK — episode_watches ready (rows: ${count})`);
await sql.end();
