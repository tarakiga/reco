import "server-only";
import { cacheLife } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { titleSlug } from "@/lib/slug";

// TVmaze's schedule API is free and keyless. We only cache the response; nothing
// is stored. It is episode/scripted-focused, so it lists shows airing (with rich
// season/episode + synopsis) rather than a 100% minute-by-minute grid.
const TVMAZE = "https://api.tvmaze.com";

export interface GuideEntry {
  id: number;
  /** Channel-local clock time, e.g. "20:00". */
  time: string | null;
  /** ISO timestamp with offset, for the "on now" check. */
  airstamp: string | null;
  showName: string;
  season: number | null;
  episode: number | null;
  episodeTitle: string | null;
  synopsis: string | null;
  runtime: number | null;
  /** Direct Haystackk title page when we can map the show (via IMDb), else our search. */
  href: string;
}

export interface GuideChannel {
  channel: string;
  entries: GuideEntry[];
}

interface TvmazeItem {
  id: number;
  airtime?: string;
  airstamp?: string;
  runtime?: number | null;
  season?: number | null;
  number?: number | null;
  name?: string | null;
  summary?: string | null;
  show?: {
    name?: string;
    network?: { name?: string } | null;
    webChannel?: { name?: string } | null;
    summary?: string | null;
    externals?: { imdb?: string | null } | null;
  };
}

function strip(html?: string | null): string | null {
  if (!html) return null;
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t || null;
}

/** Map a show's IMDb id to a Haystackk title page via TMDB; null if unmappable. */
async function hrefFromImdb(imdb: string, showName: string): Promise<string | null> {
  try {
    const f = await tmdb.findByImdb(imdb);
    const tv = f.tv_results?.[0];
    if (tv) {
      const date = tv.first_air_date ?? tv.release_date ?? null;
      return `/title/tv/${tv.id}-${titleSlug(tv.name ?? tv.title ?? showName, date)}`;
    }
    const movie = f.movie_results?.[0];
    if (movie) {
      const date = movie.release_date ?? null;
      return `/title/movie/${movie.id}-${titleSlug(movie.title ?? movie.name ?? showName, date)}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * A day's schedule for a country, grouped by channel and sorted by time.
 * Cached per (country, date). Returns [] on any failure so the page degrades to
 * an empty state instead of erroring.
 */
export async function getSchedule(country: string, date: string): Promise<GuideChannel[]> {
  "use cache";
  // A day's listings are stable once published; "on now" is computed client-side
  // from each entry's timestamp, so we can cache for hours and keep upstream
  // (TVmaze + the per-show TMDB lookups) light.
  cacheLife("hours");

  const cc = country.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  if (cc.length !== 2) return [];

  try {
    const url = `${TVMAZE}/schedule?country=${cc}${dt ? `&date=${dt}` : ""}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const items = (await res.json()) as TvmazeItem[];

    // Resolve a direct title link per unique IMDb id (deduped, in parallel).
    const imdbIds = [
      ...new Set(
        items.map((it) => it.show?.externals?.imdb).filter((v): v is string => !!v),
      ),
    ];
    const hrefByImdb = new Map<string, string>();
    await Promise.all(
      imdbIds.map(async (imdb) => {
        const name = items.find((it) => it.show?.externals?.imdb === imdb)?.show?.name ?? "";
        const href = await hrefFromImdb(imdb, name);
        if (href) hrefByImdb.set(imdb, href);
      }),
    );

    const byChannel = new Map<string, GuideEntry[]>();
    for (const it of items) {
      const show = it.show;
      const channel = show?.network?.name ?? show?.webChannel?.name;
      if (!channel || !show?.name) continue;
      const imdb = show.externals?.imdb ?? null;
      const entry: GuideEntry = {
        id: it.id,
        time: it.airtime || null,
        airstamp: it.airstamp || null,
        showName: show.name,
        season: it.season ?? null,
        episode: it.number ?? null,
        episodeTitle: it.name ?? null,
        synopsis: strip(it.summary) ?? strip(show.summary),
        runtime: it.runtime ?? null,
        href: (imdb && hrefByImdb.get(imdb)) || `/search?q=${encodeURIComponent(show.name)}`,
      };
      const arr = byChannel.get(channel);
      if (arr) arr.push(entry);
      else byChannel.set(channel, [entry]);
    }

    return [...byChannel.entries()]
      .map(([channel, entries]) => ({
        channel,
        entries: entries.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
      }))
      .sort((a, b) => a.channel.localeCompare(b.channel));
  } catch {
    return [];
  }
}
