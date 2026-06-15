// Additive migration: create the lists + list_items tables on CockroachDB.
// Safe to re-run (IF NOT EXISTS). Does not touch existing data.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false });

await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS lists (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subtitle TEXT,
    slug TEXT NOT NULL,
    published BOOL NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS list_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (list_id, title_id)
  );
`);

await sql.unsafe(`CREATE INDEX IF NOT EXISTS lists_user_idx ON lists (user_id);`);
await sql.unsafe(`CREATE INDEX IF NOT EXISTS list_items_list_pos_idx ON list_items (list_id, position);`);

const [{ count: lc }] = await sql`SELECT count(*)::int AS count FROM lists`;
const [{ count: ic }] = await sql`SELECT count(*)::int AS count FROM list_items`;
console.log(`OK — lists table ready (rows: ${lc}), list_items ready (rows: ${ic})`);
await sql.end();
