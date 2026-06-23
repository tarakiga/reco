// Additive migration: let a list item be a specific TV episode.
// Adds season_number / episode_number / episode_name to list_items and swaps the
// (list_id, title_id) uniqueness for (list_id, title_id, season_number,
// episode_number) so the same show can appear as several episodes (plus, if
// wanted, the whole show at 0/0). Safe to re-run.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) {
  console.error("COCKROACH_URL not found in .env.local");
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false });

// 1. New columns (0/0 sentinel = whole title; >0 = a specific episode).
await sql.unsafe(`ALTER TABLE list_items ADD COLUMN IF NOT EXISTS season_number INT NOT NULL DEFAULT 0`);
await sql.unsafe(`ALTER TABLE list_items ADD COLUMN IF NOT EXISTS episode_number INT NOT NULL DEFAULT 0`);
await sql.unsafe(`ALTER TABLE list_items ADD COLUMN IF NOT EXISTS episode_name TEXT`);

// 2. New uniqueness over all four columns (create first so uniqueness is never lost).
await sql.unsafe(
  `CREATE UNIQUE INDEX IF NOT EXISTS list_items_list_title_ep ON list_items (list_id, title_id, season_number, episode_number)`,
);

// 3. Drop the old 2-column unique index (CockroachDB can't DROP CONSTRAINT for a
//    unique — you drop the backing index with CASCADE). The table was created
//    with an inline `UNIQUE (list_id, title_id)`, so the index name isn't known
//    up front — find the unique index over exactly those two key columns.
const idx = await sql`SHOW INDEXES FROM list_items`;
const byIndex = new Map();
for (const r of idx) {
  if (r.implicit || r.storing) continue; // key columns only
  const e = byIndex.get(r.index_name) ?? { cols: [], unique: !r.non_unique };
  e.cols.push(r.column_name);
  byIndex.set(r.index_name, e);
}
for (const [name, e] of byIndex) {
  if (name === "list_items_list_title_ep") continue; // the new one we just made
  if (e.unique && e.cols.length === 2 && e.cols.includes("list_id") && e.cols.includes("title_id")) {
    await sql.unsafe(`DROP INDEX list_items@"${name}" CASCADE`);
    console.log(`dropped old unique index: ${name}`);
  }
}

const [{ count }] = await sql`SELECT count(*)::int AS count FROM list_items`;
const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'list_items' AND column_name IN ('season_number','episode_number','episode_name')
  ORDER BY column_name
`;
console.log(`OK — list_items rows: ${count}; new columns: ${cols.map((c) => c.column_name).join(", ")}`);
await sql.end();
