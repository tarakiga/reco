import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug } from "@/lib/slug";
import type { TitleResult } from "@/lib/tmdb/transform";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";

/** The subset of a TMDB title brief needed to build a card. */
export type MoodBrief = Pick<
  TmdbTitleDetail,
  "title" | "name" | "release_date" | "first_air_date" | "poster_path"
>;

/** Pure: shape a TMDB brief into a mood card. Returns null when the fetch failed. */
export function toMoodCard(media: TitleResult["mediaType"], id: number, b: MoodBrief | null): TitleResult | null {
  if (!b) return null;
  const title = (b.title?.trim() || b.name?.trim() || "Untitled");
  const date = b.release_date ?? b.first_air_date ?? null;
  const parsed = date && date.length >= 4 ? Number(date.slice(0, 4)) : null;
  const year = parsed != null && Number.isFinite(parsed) ? parsed : null;
  return {
    kind: "title",
    mediaType: media,
    tmdbId: id,
    title,
    year,
    releaseDate: date,
    posterUrl: posterUrl(b.poster_path ?? null),
    href: `/title/${media}/${id}-${titleSlug(title, date)}`,
  };
}
