import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug, yearFromDate } from "@/lib/slug";
import type { TitleResult } from "@/lib/tmdb/transform";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";

/** The subset of a TMDB title brief needed to build a card. */
export type TmdbBrief = Pick<
  TmdbTitleDetail,
  "title" | "name" | "release_date" | "first_air_date" | "poster_path" | "adult"
>;

/** Pure: shape a TMDB brief into a card. Returns null when there is no brief
 *  (the fetch failed) or the title is adult, which we never surface. */
export function tmdbBriefToTitleResult(
  mediaType: TitleResult["mediaType"],
  tmdbId: number,
  brief: TmdbBrief | null | undefined,
): TitleResult | null {
  if (!brief || brief.adult) return null;
  // TV briefs carry name/first_air_date and movies title/release_date, but each
  // falls back to the other so an unexpected payload still yields a usable card.
  const [name, altName] = mediaType === "tv" ? [brief.name, brief.title] : [brief.title, brief.name];
  const [when, altWhen] =
    mediaType === "tv"
      ? [brief.first_air_date, brief.release_date]
      : [brief.release_date, brief.first_air_date];

  const title = name?.trim() || altName?.trim() || "Untitled";
  const date = when?.trim() || altWhen?.trim() || null;
  return {
    kind: "title",
    mediaType,
    tmdbId,
    title,
    year: yearFromDate(date),
    releaseDate: date,
    posterUrl: posterUrl(brief.poster_path ?? null),
    href: `/title/${mediaType}/${tmdbId}-${titleSlug(title, date)}`,
  };
}
