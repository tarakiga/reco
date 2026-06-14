// Update the "brand" content block on CockroachDB (working copy + a new published
// version snapshot). Run AFTER the data migration so it isn't overwritten.
// Usage: node scripts/set-brand.mjs "Haystackk"
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const name = process.argv[2] || "Haystackk";
const body = `<p>${name}</p>`;
const sql = postgres(url, { max: 1, prepare: false });

try {
  const [wc] = await sql`SELECT title FROM content_blocks WHERE key = 'brand'`;
  if (!wc) throw new Error("no 'brand' content block found");
  const title = wc.title;
  await sql`UPDATE content_blocks SET body = ${body}, updated_by = 'rename', updated_at = now() WHERE key = 'brand'`;
  const [{ v }] = await sql`SELECT COALESCE(MAX(version), 0) + 1 AS v FROM config_versions WHERE entity_type = 'content_block' AND entity_key = 'brand'`;
  await sql`INSERT INTO config_versions (entity_type, entity_key, version, snapshot, published_by)
            VALUES ('content_block', 'brand', ${v}, ${sql.json({ key: "brand", title, body })}, 'rename')`;
  console.log(`brand -> "${name}" (published version ${v})`);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
