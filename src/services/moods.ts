import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { toBrowseResults } from "@/lib/tmdb/discover";
import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug } from "@/lib/slug";
import type { TitleResult } from "@/lib/tmdb/transform";
import { getMoodBySlug, type MoodQuery } from "@/lib/moods";

function buildParams(q: MoodQuery, page: number): Record<string, string> {
  const p: Record<string, string> = {
    sort_by: q.sortBy ?? "popularity.desc",
    include_adult: "false",
    "vote_count.gte": String(q.voteCountGte ?? 100),
    page: String(page),
  };
  if (q.withGenres) p.with_genres = q.withGenres;
  if (q.withoutGenres) p.without_genres = q.withoutGenres;
  if (q.withKeywords) p.with_keywords = q.withKeywords;
  if (q.voteAverageGte != null) p["vote_average.gte"] = String(q.voteAverageGte);
  if (q.certificationLte) {
    p.certification_country = "US";
    p["certification.lte"] = q.certificationLte;
  }
  return p;
}

/** Build a card from a hand-picked TMDB movie id (lightweight fetch). */
async function manualMovie(id: number): Promise<TitleResult | null> {
  const b = await tmdb.titleBrief("movie", id).catch(() => null);
  if (!b) return null;
  const name = b.title ?? b.name ?? "Untitled";
  const date = b.release_date ?? b.first_air_date ?? null;
  const year = date && date.length >= 4 ? Number(date.slice(0, 4)) : null;
  return {
    kind: "title",
    mediaType: "movie",
    tmdbId: id,
    title: name,
    year: Number.isFinite(year) ? year : null,
    releaseDate: date,
    posterUrl: posterUrl(b.poster_path ?? null),
    href: `/title/movie/${id}-${titleSlug(name, date)}`,
  };
}

/** Titles for a mood. Hand-picked `manual` list if set, otherwise TMDB Discover.
 *  Cached per mood (region-agnostic). */
export async function getMoodTitles(slug: string, pages = 1): Promise<TitleResult[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(`mood:${slug}`);

  const mood = getMoodBySlug(slug);
  if (!mood) return [];

  const seen = new Set<number>();
  const out: TitleResult[] = [];

  // Hand-picked seed first, preserving curated order. This is the whole mood for
  // a purely curated list, or a seed pinned ahead of a query fill (hybrid) when
  // a keyword query misses beloved titles (e.g. Inspirational + Miracle on 34th).
  if (mood.manual?.length) {
    const cards = await Promise.all(mood.manual.map(manualMovie));
    for (const c of cards) {
      if (c && !seen.has(c.tmdbId)) {
        seen.add(c.tmdbId);
        out.push(c);
      }
    }
  }

  // Dynamic Discover fill, appended after any seed and de-duplicated.
  if (mood.query) {
    const mt = mood.query.mediaType ?? "movie";
    for (let page = 1; page <= pages; page++) {
      const data = await tmdb.discover(mt, buildParams(mood.query, page)).catch(() => null);
      if (!data) break;
      for (const r of toBrowseResults(mt, data.results)) {
        if (seen.has(r.tmdbId)) continue;
        seen.add(r.tmdbId);
        out.push(r);
      }
      if (page >= (data.total_pages ?? 1)) break;
    }
  }

  return out;
}
