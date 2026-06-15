// Replicate getPersonShowCredit against real TMDB for a known guest case:
// Brad Pitt (287) in Friends (1668) — should be guest, S8E9.
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const KEY = env.match(/^TMDB_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const BASE = "https://api.themoviedb.org/3";
const get = async (path, params = {}) => {
  const u = new URL(BASE + path);
  u.searchParams.set("api_key", KEY);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
};

const personId = Number(process.argv[2] || 287);
const tvId = Number(process.argv[3] || 1668);

const show = await get(`/${"tv"}/${tvId}`, { append_to_response: "credits" });
console.log("show:", show.name);
const mainCast = (show.credits?.cast ?? []).some((c) => c.id === personId);
console.log("mainCast?", mainCast);

if (!mainCast) {
  const seasons = (show.seasons ?? []).filter((s) => s.season_number > 0).map((s) => s.season_number);
  const eps = [];
  await Promise.all(
    seasons.map(async (n) => {
      const data = await get(`/tv/${tvId}/season/${n}`);
      for (const e of data.episodes ?? []) {
        if ((e.guest_stars ?? []).some((g) => g.id === personId)) {
          eps.push({ s: n, e: e.episode_number, name: e.name, year: (e.air_date || "").slice(0, 4) });
        }
      }
    }),
  );
  eps.sort((a, b) => a.s - b.s || a.e - b.e);
  console.log("guest episodes:", JSON.stringify(eps));
}
