import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS favourites (
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title_id uuid NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, title_id)
  )`;

console.log("favourites table ready");
