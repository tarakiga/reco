// Additive migration: create the polls + poll_votes tables ("Vote to Watch").
// Safe to re-run (IF NOT EXISTS). Does not touch existing data.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false });

await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS polls (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    expected_voters INT NOT NULL,
    deadline TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'round1',
    round2_title_ids UUID[],
    winner_title_id UUID REFERENCES titles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    round INT NOT NULL,
    title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (poll_id, user_id, round)
  );
`);

await sql.unsafe(`CREATE INDEX IF NOT EXISTS polls_creator_idx ON polls (creator_id);`);
await sql.unsafe(`CREATE INDEX IF NOT EXISTS poll_votes_poll_round_idx ON poll_votes (poll_id, round);`);

const [{ count: pc }] = await sql`SELECT count(*)::int AS count FROM polls`;
const [{ count: vc }] = await sql`SELECT count(*)::int AS count FROM poll_votes`;
console.log(`OK — polls ready (rows: ${pc}), poll_votes ready (rows: ${vc})`);
await sql.end();
