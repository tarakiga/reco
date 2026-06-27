import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { diary, titles } from "@/db/schema";
import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug } from "@/lib/slug";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";

export interface WrappedStats {
  year: number;
  logs: number;
  uniqueTitles: number;
  movies: number;
  shows: number;
  minutes: number;
  topGenres: { name: string; count: number }[];
  topDecade: { decade: number; count: number } | null;
  busiestMonth: { month: number; count: number } | null;
  mostWatched: { title: string; href: string; count: number; posterUrl: string | null } | null;
}

/** A "Year in Film" summary from the user's diary (with title metadata) for a year. */
export async function getWrapped(userId: string, year: number): Promise<WrappedStats> {
  const rows = await db
    .select({
      watchedOn: diary.watchedOn,
      titleId: diary.titleId,
      tmdbId: titles.tmdbId,
      mediaType: titles.mediaType,
      title: titles.title,
      releaseYear: titles.releaseYear,
      posterPath: titles.posterPath,
      slug: titles.slug,
      metadata: titles.metadata,
    })
    .from(diary)
    .innerJoin(titles, eq(titles.id, diary.titleId))
    .where(and(eq(diary.userId, userId), gte(diary.watchedOn, `${year}-01-01`), lte(diary.watchedOn, `${year}-12-31`)));

  const base: WrappedStats = {
    year, logs: rows.length, uniqueTitles: 0, movies: 0, shows: 0, minutes: 0,
    topGenres: [], topDecade: null, busiestMonth: null, mostWatched: null,
  };
  if (rows.length === 0) return base;

  const titleCounts = new Map<string, { count: number; title: string; href: string; posterUrl: string | null }>();
  const genreCounts = new Map<string, number>();
  const decadeCounts = new Map<number, number>();
  const monthCounts = new Map<number, number>();
  let minutes = 0;
  let movies = 0;
  let shows = 0;

  for (const r of rows) {
    const meta = (r.metadata ?? {}) as TmdbTitleDetail;
    if (r.mediaType === "movie") {
      movies++;
      minutes += meta.runtime ?? 0;
    } else {
      shows++;
      minutes += meta.episode_run_time?.[0] ?? 45;
    }
    for (const g of meta.genres ?? []) genreCounts.set(g.name, (genreCounts.get(g.name) ?? 0) + 1);
    if (r.releaseYear) {
      const d = Math.floor(r.releaseYear / 10) * 10;
      decadeCounts.set(d, (decadeCounts.get(d) ?? 0) + 1);
    }
    const month = Number(r.watchedOn.slice(5, 7));
    if (month >= 1 && month <= 12) monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    const href = `/title/${r.mediaType}/${r.tmdbId}-${r.slug || titleSlug(r.title, null)}`;
    const tc = titleCounts.get(r.titleId) ?? { count: 0, title: r.title, href, posterUrl: posterUrl(r.posterPath) };
    tc.count++;
    titleCounts.set(r.titleId, tc);
  }

  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const topDecadeEntry = [...decadeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const busiestEntry = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const mostWatchedEntry = [...titleCounts.values()].sort((a, b) => b.count - a.count)[0];

  return {
    ...base,
    uniqueTitles: titleCounts.size,
    movies,
    shows,
    minutes,
    topGenres,
    topDecade: topDecadeEntry ? { decade: topDecadeEntry[0], count: topDecadeEntry[1] } : null,
    busiestMonth: busiestEntry ? { month: busiestEntry[0], count: busiestEntry[1] } : null,
    mostWatched: mostWatchedEntry ?? null,
  };
}
