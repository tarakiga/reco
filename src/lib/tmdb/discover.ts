import { titleSlug } from "@/lib/slug";
import { posterUrl } from "./images";
import { isSuppressedTitle } from "./suppressed";
import type { TitleResult } from "./transform";
import type { TmdbSearchItem } from "./types";

export function toBrowseResults(
  mediaType: "movie" | "tv",
  items: TmdbSearchItem[],
): TitleResult[] {
  return items
    .filter((it) => !isSuppressedTitle(mediaType, it.id))
    .map((it) => {
    const name = it.title ?? it.name ?? "Untitled";
    const date = it.release_date ?? it.first_air_date ?? null;
    const year = date && date.length >= 4 ? Number(date.slice(0, 4)) : null;
    return {
      kind: "title",
      mediaType,
      tmdbId: it.id,
      title: name,
      year: Number.isFinite(year) ? year : null,
      releaseDate: date,
      posterUrl: posterUrl(it.poster_path),
      href: `/title/${mediaType}/${it.id}-${titleSlug(name, date)}`,
    };
  });
}

export function buildDiscoverParams(
  mediaType: "movie" | "tv",
  filters: { genre?: string; year?: string },
): Record<string, string> {
  const params: Record<string, string> = {
    sort_by: "popularity.desc",
    include_adult: "false",
  };
  if (filters.genre) params.with_genres = filters.genre;
  if (filters.year) {
    params[mediaType === "movie" ? "primary_release_year" : "first_air_date_year"] = filters.year;
  }
  return params;
}
