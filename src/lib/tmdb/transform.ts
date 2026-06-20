import { titleSlug, slugify } from "@/lib/slug";
import { posterUrl, profileUrl } from "./images";
import type { TmdbSearchItem } from "./types";

export interface TitleResult {
  kind: "title";
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  releaseDate: string | null;
  posterUrl: string | null;
  href: string;
  /** Release calendar: `releaseDate` is an estimated VOD window, not a confirmed
   *  date. Drives an "Est." badge so users know it's a projection. */
  estimated?: boolean;
}
export interface PersonResult {
  kind: "person";
  tmdbId: number;
  name: string;
  profileUrl: string | null;
  href: string;
}
export type SearchResult = TitleResult | PersonResult;

export function toSearchResults(items: TmdbSearchItem[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const it of items) {
    if (it.media_type === "movie" || it.media_type === "tv") {
      const name = it.title ?? it.name ?? "Untitled";
      const date = it.release_date ?? it.first_air_date ?? null;
      const year = date && date.length >= 4 ? Number(date.slice(0, 4)) : null;
      out.push({
        kind: "title",
        mediaType: it.media_type,
        tmdbId: it.id,
        title: name,
        year: Number.isFinite(year) ? year : null,
        releaseDate: date,
        posterUrl: posterUrl(it.poster_path),
        href: `/title/${it.media_type}/${it.id}-${titleSlug(name, date)}`,
      });
    } else if (it.media_type === "person") {
      out.push({
        kind: "person",
        tmdbId: it.id,
        name: it.name ?? "Unknown",
        profileUrl: profileUrl(it.profile_path),
        href: `/person/${it.id}-${slugify(it.name ?? "unknown")}`,
      });
    }
  }
  return out;
}
