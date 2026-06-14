import { readFileSync } from "node:fs";
import postgres from "postgres";

const parse = (s) => Object.fromEntries(s.split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]));
const env = parse(readFileSync(new URL("../.env.local", import.meta.url), "utf8"));
const sql = postgres(env.COCKROACH_URL, { max: 1, prepare: false });

async function embed(text) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ model: "voyage-3.5", input: [text], input_type: "query", output_dimension: 1024 }),
  });
  if (!res.ok) throw new Error("voyage " + res.status);
  return (await res.json()).data[0].embedding;
}

async function search(vec, mediaType, limit = 50) {
  const lit = "[" + vec.join(",") + "]";
  const filter = mediaType ? `AND t.media_type = '${mediaType}'` : "";
  return sql.unsafe(`SELECT t.tmdb_id, t.media_type, t.title, t.release_year, 1 - (te.embedding <=> '${lit}'::vector) AS cos
    FROM title_embeddings te JOIN titles t ON t.id = te.title_id
    WHERE 1=1 ${filter} ORDER BY te.embedding <=> '${lit}'::vector LIMIT ${limit}`);
}

const FOL = 1803;
const show = (rows) => rows.slice(0, 8).map((r, i) => `${i + 1}.${r.title}(${r.media_type},${r.cos.toFixed(3)})`).join("  ");
const rankFOL = (rows) => { const i = rows.findIndex((r) => Number(r.tmdb_id) === FOL); return i < 0 ? ">50" : `#${i + 1}`; };

try {
  const cases = [
    ["A) raw, no filter", "Tvshow where with girls in a dorm", null],
    ["B) cleaned, no filter", "girls in a dorm", null],
    ["C) cleaned, TV filter", "girls in a dorm", "tv"],
    ["D) expanded, TV filter", "teenage girls living together in a dormitory at a boarding school, coming of age", "tv"],
    ["E) combined (literal + expansion), TV filter", "girls in a dorm. teenage girls living together in a dormitory at a boarding school, an all-girls coming-of-age comedy drama", "tv"],
  ];
  for (const [label, q, mt] of cases) {
    const vec = await embed(q);
    const rows = await search(vec, mt);
    console.log(`\n${label}  [Facts of Life: ${rankFOL(rows)}]`);
    console.log("  top:", show(rows));
  }
} catch (e) {
  console.error("ERR", e.message);
} finally {
  await sql.end();
}
