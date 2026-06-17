// Migrate poll_votes to support guest (cookie) voters: add voter_key, backfill
// from existing user ids, make user_id nullable, swap the unique constraint.
// Idempotent.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false });

await sql.unsafe(`ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS voter_key TEXT`);
// Backfill existing (all signed-in) votes.
await sql.unsafe(`UPDATE poll_votes SET voter_key = 'u:' || user_id::string WHERE voter_key IS NULL`);
await sql.unsafe(`ALTER TABLE poll_votes ALTER COLUMN voter_key SET NOT NULL`);
await sql.unsafe(`ALTER TABLE poll_votes ALTER COLUMN user_id DROP NOT NULL`);

// New unique on (poll, voter_key, round); drop the old (poll, user_id, round).
await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_voter_round ON poll_votes (poll_id, voter_key, round)`);
try {
  await sql.unsafe(`ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_poll_user_round`);
} catch (e) {
  console.log("drop constraint note:", e.message);
}
try {
  await sql.unsafe(`DROP INDEX IF EXISTS poll_votes_poll_user_round CASCADE`);
} catch (e) {
  console.log("drop index note:", e.message);
}

const [{ count }] = await sql`SELECT count(*)::int AS count FROM poll_votes`;
const [{ nulls }] = await sql`SELECT count(*)::int AS nulls FROM poll_votes WHERE voter_key IS NULL`;
console.log(`OK — poll_votes ready (rows: ${count}, voter_key nulls: ${nulls})`);
await sql.end();
