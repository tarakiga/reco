// End-to-end check of the prod calendar feed WITHOUT printing the private token.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false });

const [row] = await sql`
  SELECT p.id::text AS id, count(*)::int AS tv
  FROM profiles p
  JOIN watchlist_items w ON w.user_id = p.id
  JOIN titles t ON t.id = w.title_id
  WHERE t.media_type = 'tv'
  GROUP BY p.id
  ORDER BY tv DESC
  LIMIT 1`;
await sql.end();

if (!row) {
  console.log("No profile has TV shows on its watchlist yet — feed would be valid but empty.");
  process.exit(0);
}

const res = await fetch(`https://www.haystackk.com/api/calendar/${row.id}.ics`);
const body = await res.text();
const vevents = (body.match(/BEGIN:VEVENT/g) || []).length;
const firstSummary = (body.match(/SUMMARY:(.+)/) || [])[1]?.trim();

console.log("status:", res.status);
console.log("content-type:", res.headers.get("content-type"));
console.log("valid VCALENDAR:", body.startsWith("BEGIN:VCALENDAR"));
console.log("tv shows on that watchlist:", row.tv, "| upcoming episodes in feed:", vevents);
if (firstSummary) console.log("sample event:", firstSummary);
