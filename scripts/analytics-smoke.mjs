import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false });

const Q = {
  signups: `SELECT to_char(date_trunc('week', created_at), 'Mon DD') AS label, count(*)::int n
            FROM profiles GROUP BY date_trunc('week', created_at)
            ORDER BY date_trunc('week', created_at) DESC LIMIT 12`,
  activity: `SELECT to_char(week, 'Mon DD') AS label, sum(c)::int n FROM (
               SELECT date_trunc('week', rated_at) AS week, count(*) c FROM ratings GROUP BY 1
               UNION ALL
               SELECT date_trunc('week', added_at) AS week, count(*) c FROM watchlist_items GROUP BY 1
             ) x GROUP BY week ORDER BY week DESC LIMIT 12`,
  ratingDist: `SELECT score::text AS label, count(*)::int n FROM ratings GROUP BY score ORDER BY score DESC`,
  topRated: `SELECT t.tmdb_id, t.media_type, t.title, avg(r.score)::float a, count(*)::int n
             FROM ratings r JOIN titles t ON t.id = r.title_id
             GROUP BY 1,2,3 HAVING count(*) >= 2 ORDER BY a DESC, n DESC LIMIT 8`,
  genres: `SELECT g->>'name' AS label, count(*)::int n
           FROM ratings r JOIN titles t ON t.id = r.title_id
           CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.metadata->'genres', '[]'::jsonb)) g
           WHERE r.score >= 4 GROUP BY 1 ORDER BY n DESC LIMIT 10`,
  users: `SELECT count(*)::int n FROM profiles`,
};

try {
  for (const [name, q] of Object.entries(Q)) {
    try {
      const r = await sql.unsafe(q);
      console.log(`OK   ${name.padEnd(11)} rows=${r.length}  ${JSON.stringify(r.slice(0, 3))}`);
    } catch (e) {
      console.log(`FAIL ${name.padEnd(11)} ${e.message.slice(0, 120)}`);
    }
  }
} finally {
  await sql.end();
}
