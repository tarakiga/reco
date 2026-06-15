import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const KEY = env.match(/^TMDB_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const personId = Number(process.argv[2] || 287); // Brad Pitt

// 1. TMDB person external_ids → wikidata_id
const ext = await (await fetch(`https://api.themoviedb.org/3/person/${personId}/external_ids?api_key=${KEY}`)).json();
console.log("wikidata_id:", ext.wikidata_id, "| imdb:", ext.imdb_id);
if (!ext.wikidata_id) process.exit(0);

// 2. Wikidata P166 (award received) + P1411 (nominated)
const query = `SELECT ?prop ?valLabel WHERE {
  VALUES (?prop ?p) { ('award' wdt:P166) ('nominated' wdt:P1411) }
  wd:${ext.wikidata_id} ?p ?val.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
  headers: { "User-Agent": "haystackk/1.0", Accept: "application/sparql-results+json" },
});
const bindings = (await res.json()).results?.bindings ?? [];
const wins = bindings.filter((b) => b.prop.value === "award").map((b) => b.valLabel.value);
const noms = bindings.filter((b) => b.prop.value === "nominated").map((b) => b.valLabel.value);
const kw = (list, k) => list.filter((l) => l.toLowerCase().includes(k)).length;
console.log("WINS:", wins.length, "| oscars:", kw(wins, "academy award"), "| emmys:", kw(wins, "emmy"), "| golden globes:", kw(wins, "golden globe"));
console.log("NOMINATIONS:", noms.length);
console.log("sample wins:", wins.slice(0, 6).join(" | "));
