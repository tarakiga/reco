// Additive migration: per-list toggle for the "A list by <author>" byline.
// Defaults to true so existing lists keep showing it. Safe to re-run.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) {
  console.error("COCKROACH_URL not found in .env.local");
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false });

await sql.unsafe(`ALTER TABLE lists ADD COLUMN IF NOT EXISTS show_author BOOL NOT NULL DEFAULT true`);

const [{ ok }] = await sql`
  SELECT count(*)::int AS ok FROM information_schema.columns
  WHERE table_name = 'lists' AND column_name = 'show_author'
`;
console.log(ok ? "OK — lists.show_author ready" : "FAILED — column missing");
await sql.end();
