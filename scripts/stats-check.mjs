import { readFileSync } from "node:fs";
import postgres from "postgres";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false });
const STAR = "★";
let listId;
try {
  const [p] = await sql`SELECT id FROM profiles LIMIT 1`;
  const [mv] = await sql`SELECT id, title FROM titles WHERE media_type='movie'
    AND (metadata->>'vote_average')::float > 3 AND (metadata->>'runtime')::int > 0 LIMIT 1`;
  const [tv] = await sql`SELECT id, title FROM titles WHERE media_type='tv'
    AND (metadata->>'number_of_seasons')::int > 0 LIMIT 1`;
  const [l] = await sql`INSERT INTO lists (user_id,title,subtitle,slug,published)
    VALUES (${p.id},'__stats2','s','stats2',true) RETURNING id, slug`;
  listId = l.id;
  await sql`INSERT INTO list_items (list_id,title_id,position) VALUES (${listId},${mv.id},0),(${listId},${tv.id},1)`;

  const body = await (await fetch(`https://www.haystackk.com/list/${listId}-${l.slug}?z=1`)).text();
  // Strip tags to inspect visible text only.
  const text = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  console.log("star rating rendered:", text.includes(STAR));
  console.log("runtime rendered (Xh Xm):", /\d+h(\s\d+m)?/.test(text));
  console.log("season count rendered:", /\d+\sseasons?/.test(text));
  const around = (t) => { const i = text.indexOf(t); return i < 0 ? "(not found)" : text.slice(i, i + 90); };
  console.log("movie line:", around(mv.title));
  console.log("tv line:", around(tv.title));
} finally {
  if (listId) await sql`DELETE FROM lists WHERE id=${listId}`;
  await sql.end();
  console.log("cleaned up");
}
