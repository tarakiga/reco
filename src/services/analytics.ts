import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { titleSlug } from "@/lib/slug";

const rows = (r: unknown) => ((r as { rows?: Record<string, unknown>[] }).rows ?? r) as Record<string, unknown>[];
const n = (v: unknown) => Number(v ?? 0);
const one = (r: unknown) => n(rows(r)[0]?.n);

export interface Bucket {
  label: string;
  value: number;
}
export interface TitleStat {
  href: string;
  title: string;
  mediaType: "movie" | "tv";
  value: number;
  sub?: string;
}
export interface Analytics {
  users: { total: number; rated: number; watchlisted: number; onboarded: number };
  totals: { ratings: number; watchlist: number; favourites: number };
  catalog: { titles: number; embeddings: number; coveragePct: number };
  ratingDist: Bucket[];
  watchlistStatus: Bucket[];
  signups: Bucket[];
  activity: Bucket[];
  topRated: TitleStat[];
  mostRated: TitleStat[];
  topGenres: Bucket[];
}

const STATUS_LABEL: Record<string, string> = {
  want_to_watch: "Want to watch",
  watching: "Watching",
  watched: "Watched",
};

const titleHref = (r: Record<string, unknown>): TitleStat => {
  const title = r.title as string;
  const mediaType = r.media_type as "movie" | "tv";
  return {
    title,
    mediaType,
    href: `/title/${mediaType}/${r.tmdb_id}-${titleSlug(title, null)}`,
    value: n(r.n),
    sub: r.a != null ? `${Number(r.a).toFixed(1)}★ · ${n(r.n)} ratings` : undefined,
  };
};

/** Aggregate analytics for the admin dashboard. Read-only; all queries are cheap
 *  aggregations over small tables (ratings/watchlist) plus a couple of counts. */
export async function getAnalytics(): Promise<Analytics> {
  const [
    usersTotal, usersRated, usersWatchlisted, usersOnboarded,
    totRatings, totWatchlist, totFav,
    catTitles, catEmb,
    ratingDistQ, watchStatusQ, signupsQ, activityQ, topRatedQ, mostRatedQ, genresQ,
  ] = await Promise.all([
    db.execute(sql`SELECT count(*)::int n FROM profiles`),
    db.execute(sql`SELECT count(DISTINCT user_id)::int n FROM ratings`),
    db.execute(sql`SELECT count(DISTINCT user_id)::int n FROM watchlist_items`),
    db.execute(sql`SELECT count(*)::int n FROM user_taste`),
    db.execute(sql`SELECT count(*)::int n FROM ratings`),
    db.execute(sql`SELECT count(*)::int n FROM watchlist_items`),
    db.execute(sql`SELECT count(*)::int n FROM favourites`),
    db.execute(sql`SELECT count(*)::int n FROM titles`),
    db.execute(sql`SELECT count(*)::int n FROM title_embeddings`),
    db.execute(sql`SELECT score::text AS label, count(*)::int n FROM ratings GROUP BY score ORDER BY score DESC`),
    db.execute(sql`SELECT status AS label, count(*)::int n FROM watchlist_items GROUP BY status`),
    db.execute(sql`SELECT to_char(date_trunc('week', created_at), 'Mon DD') AS label, count(*)::int n
                   FROM profiles GROUP BY date_trunc('week', created_at)
                   ORDER BY date_trunc('week', created_at) DESC LIMIT 12`),
    db.execute(sql`SELECT to_char(week, 'Mon DD') AS label, sum(c)::int n FROM (
                     SELECT date_trunc('week', rated_at) AS week, count(*) c FROM ratings GROUP BY 1
                     UNION ALL
                     SELECT date_trunc('week', added_at) AS week, count(*) c FROM watchlist_items GROUP BY 1
                   ) x GROUP BY week ORDER BY week DESC LIMIT 12`),
    db.execute(sql`SELECT t.tmdb_id, t.media_type, t.title, avg(r.score)::float a, count(*)::int n
                   FROM ratings r JOIN titles t ON t.id = r.title_id
                   GROUP BY 1, 2, 3 HAVING count(*) >= 2 ORDER BY a DESC, n DESC LIMIT 8`),
    db.execute(sql`SELECT t.tmdb_id, t.media_type, t.title, count(*)::int n
                   FROM ratings r JOIN titles t ON t.id = r.title_id
                   GROUP BY 1, 2, 3 ORDER BY n DESC LIMIT 8`),
    db.execute(sql`SELECT g->>'name' AS label, count(*)::int n
                   FROM ratings r JOIN titles t ON t.id = r.title_id
                   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.metadata->'genres', '[]'::jsonb)) g
                   WHERE r.score >= 4 GROUP BY 1 ORDER BY n DESC LIMIT 10`),
  ]);

  const titles = one(catTitles);
  const embeddings = one(catEmb);

  return {
    users: {
      total: one(usersTotal),
      rated: one(usersRated),
      watchlisted: one(usersWatchlisted),
      onboarded: one(usersOnboarded),
    },
    totals: { ratings: one(totRatings), watchlist: one(totWatchlist), favourites: one(totFav) },
    catalog: { titles, embeddings, coveragePct: titles ? Math.round((embeddings / titles) * 100) : 0 },
    ratingDist: rows(ratingDistQ).map((r) => ({ label: `${r.label}★`, value: n(r.n) })),
    watchlistStatus: rows(watchStatusQ).map((r) => ({ label: STATUS_LABEL[r.label as string] ?? (r.label as string), value: n(r.n) })),
    signups: rows(signupsQ).map((r) => ({ label: r.label as string, value: n(r.n) })).reverse(),
    activity: rows(activityQ).map((r) => ({ label: r.label as string, value: n(r.n) })).reverse(),
    topRated: rows(topRatedQ).map(titleHref),
    mostRated: rows(mostRatedQ).map(titleHref),
    topGenres: rows(genresQ).map((r) => ({ label: r.label as string, value: n(r.n) })),
  };
}
