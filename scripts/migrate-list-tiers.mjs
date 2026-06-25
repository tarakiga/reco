// Additive migration: tier-list support for shareable lists.
// Adds list_items.tier (S/A/B/C or null) and lists.tiered (render as a tier
// list). Safe to re-run. No impact on existing lists (default not tiered).
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) {
  console.error("COCKROACH_URL not found in .env.local");
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false });

await sql.unsafe(`ALTER TABLE list_items ADD COLUMN IF NOT EXISTS tier TEXT`);
await sql.unsafe(`ALTER TABLE lists ADD COLUMN IF NOT EXISTS tiered BOOL NOT NULL DEFAULT false`);

const cols = await sql`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE (table_name = 'list_items' AND column_name = 'tier')
     OR (table_name = 'lists' AND column_name = 'tiered')
  ORDER BY table_name, column_name
`;
console.log("OK — added:", cols.map((c) => `${c.table_name}.${c.column_name}`).join(", "));
await sql.end();
