import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug } from "@/lib/slug";
import type { TitleResult } from "@/lib/tmdb/transform";
import type { MoodMedia } from "@/lib/moods";

/** Minimal shape both `titleBrief` responses share. */
export interface MoodBrief {
  title?: string | null;
  name?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  poster_path?: string | null;
}

/** Pure: shape a TMDB brief into a mood card. Returns null when the fetch failed. */
export function toMoodCard(media: MoodMedia, id: number, b: MoodBrief | null): TitleResult | null {
  if (!b) return null;
  const name = b.title ?? b.name ?? "Untitled";
  const date = b.release_date ?? b.first_air_date ?? null;
  const parsed = date && date.length >= 4 ? Number(date.slice(0, 4)) : null;
  const year = parsed != null && Number.isFinite(parsed) ? parsed : null;
  return {
    kind: "title",
    mediaType: media,
    tmdbId: id,
    title: name,
    year,
    releaseDate: date,
    posterUrl: posterUrl(b.poster_path ?? null),
    href: `/title/${media}/${id}-${titleSlug(name, date)}`,
  };
}
