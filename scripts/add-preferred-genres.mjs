import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_genres integer[]`;
console.log("preferred_genres ready");
