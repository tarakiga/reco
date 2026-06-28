import { sql } from "./_db.mjs";

await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_genres integer[]`;
console.log("preferred_genres ready");
await sql.end();
