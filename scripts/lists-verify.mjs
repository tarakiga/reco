// E2E re-check: temp published list -> verify page + OG + privacy, then delete.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let listId;

try {
  const [profile] = await sql`SELECT id FROM profiles LIMIT 1`;
  // Prefer titles that actually have videos (so a trailer button renders).
  const titles = await sql`
    SELECT id, title FROM titles
    WHERE jsonb_array_length(COALESCE(metadata->'videos'->'results', '[]'::jsonb)) > 0
    ORDER BY refreshed_at DESC LIMIT 3`;
  if (titles.length === 0) throw new Error("no titles with videos");

  const [list] = await sql`
    INSERT INTO lists (user_id, title, subtitle, slug, published)
    VALUES (${profile.id}, ${"__verify Mind Movies"}, ${"a temporary verification list"}, ${"verify-mind-movies"}, true)
    RETURNING id, slug`;
  listId = list.id;
  for (let i = 0; i < titles.length; i++) {
    await sql`INSERT INTO list_items (list_id, title_id, position) VALUES (${listId}, ${titles[i].id}, ${i})`;
  }

  const pageUrl = `https://www.haystackk.com/list/${listId}-${list.slug}`;
  const ogUrl = `${pageUrl}/opengraph-image`;

  // Poll the OG until it stops 500ing (signals the new deploy is live).
  let ogStatus = 0, ogType = null, ogBytes = 0;
  for (let i = 0; i < 30; i++) {
    const og = await fetch(ogUrl);
    ogStatus = og.status;
    if (ogStatus === 200) {
      ogType = og.headers.get("content-type");
      ogBytes = (await og.arrayBuffer()).byteLength;
      break;
    }
    await sleep(10000);
  }
  console.log("OG status:", ogStatus, "| type:", ogType, "| bytes:", ogBytes);

  const res = await fetch(pageUrl);
  const body = await res.text();
  console.log("page status:", res.status);
  console.log("title + subtitle present:", body.includes("__verify Mind Movies") && body.includes("a temporary verification list"));
  console.log("item titles present:", titles.filter((t) => body.includes(t.title)).length, "/", titles.length);
  console.log("Trailer button present:", body.includes(">Trailer<"));

  await sql`UPDATE lists SET published = false WHERE id = ${listId}`;
  await sleep(1500);
  const draft = await fetch(pageUrl, { headers: { "cache-control": "no-cache" } });
  console.log("unpublished page status (expect 404):", draft.status);
} finally {
  if (listId) {
    await sql`DELETE FROM lists WHERE id = ${listId}`;
    console.log("cleanup: temp list deleted");
  }
  await sql.end();
}
