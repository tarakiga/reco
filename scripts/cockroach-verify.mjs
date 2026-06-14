import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1 });
try {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log("tables:", tables.map((t) => t.table_name).join(", "));
  const cols = await sql`
    SELECT column_name, data_type, udt_name FROM information_schema.columns
    WHERE table_name = 'title_embeddings' ORDER BY ordinal_position`;
  console.log("title_embeddings cols:", cols.map((c) => `${c.column_name}:${c.udt_name || c.data_type}`).join(", "));
} catch (e) {
  console.error("ERROR:", e.message);
} finally {
  await sql.end();
}
