// End-to-end scene-search pipeline test with REAL Gemini + Voyage + DB.
// Replicates parseMediaIntent + expandSceneQuery + searchByScene.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const parse = (s) => Object.fromEntries(s.split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]));
const env = parse(readFileSync(new URL("../.env.local", import.meta.url), "utf8"));
const sql = postgres(env.COCKROACH_URL, { max: 1, prepare: false });

const TV = /\b(tv[-\s]?shows?|tv[-\s]?series|television\s+series|mini[-\s]?series|sitcoms?)\b/gi;
const MOVIE = /\b(movies?|films?)\b/gi;
function parseIntent(raw) {
  const tv = TV.test(raw); TV.lastIndex = 0;
  const mv = MOVIE.test(raw); MOVIE.lastIndex = 0;
  let mt = null; if (tv && !mv) mt = "tv"; else if (mv && !tv) mt = "movie";
  let cleaned = raw.replace(TV, " ").replace(MOVIE, " ").replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/^(?:(?:the|a|an|that|this|where|with|about|of|in|me|find|one|some)\b\s*)+/i, "").trim();
  return { mt, cleaned: cleaned || raw };
}

const prompt = (q) => `Rewrite this vague movie/TV-show memory into ONE concise search phrase (under 25 words). Keep the literal subject and add only direct synonyms for the setting (dorm = boarding school, dormitory, residence hall) and the broad genre (e.g. comedy, drama). Do NOT invent narrow plot themes (no "secret societies", "academic rivalry") and do NOT narrow the era or age group. No titles, no preamble.

Memory: "${q}"`;

async function geminiExpand(q) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt(q) }] }], generationConfig: { maxOutputTokens: 256, temperature: 0.3 } }),
  });
  if (!res.ok) return { err: `${res.status} ${(await res.text()).slice(0, 160)}` };
  const j = await res.json();
  return { text: j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join(" ").trim() };
}

async function voyage(text) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ model: "voyage-3.5", input: [text], input_type: "query", output_dimension: 1024 }),
  });
  return (await res.json()).data[0].embedding;
}

async function search(vec, mt, limit = 50) {
  const lit = "[" + vec.join(",") + "]";
  const f = mt ? `AND t.media_type='${mt}'` : "";
  return sql.unsafe(`SELECT t.tmdb_id, t.media_type, t.title, 1-(te.embedding <=> '${lit}'::vector) cos FROM title_embeddings te JOIN titles t ON t.id=te.title_id WHERE 1=1 ${f} ORDER BY te.embedding <=> '${lit}'::vector LIMIT ${limit}`);
}

try {
  const raw = process.argv[2] || "Tvshow where with girls in a dorm";
  const { mt, cleaned } = parseIntent(raw);
  console.log("RAW       :", raw);
  console.log("DETECTED  :", mt, "| CLEANED:", cleaned);
  const exp = await geminiExpand(cleaned);
  if (exp.err) { console.log("GEMINI ERR:", exp.err); }
  console.log("EXPANSION :", exp.text || "(none)");
  const combined = exp.text ? `${cleaned}. ${exp.text}` : cleaned;
  const rows = await search(await voyage(combined), mt);
  const i = rows.findIndex((r) => /facts of life/i.test(r.title) && r.media_type === "tv");
  console.log("FOL RANK  :", i < 0 ? ">50" : `#${i + 1}`);
  console.log("TOP 10    :", rows.slice(0, 10).map((r, n) => `${n + 1}.${r.title}`).join(" | "));
} catch (e) {
  console.error("ERR", e.message);
} finally {
  await sql.end();
}
