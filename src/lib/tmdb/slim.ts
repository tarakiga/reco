import type { TmdbTitleDetail } from "./types";

/** Regions we keep watch-provider + certification data for. Covers our account
 *  region options plus the major entertainment markets; everything else is
 *  dropped to keep stored metadata small. */
export const KEEP_REGIONS = new Set([
  "US", "GB", "CA", "AU", "IE", "NZ", "DE", "FR", "ES", "IT", "NL", "SE",
  "BR", "MX", "AR", "IN", "JP", "KR", "NG", "ZA", "PH", "ID",
]);

const KEY_CREW_JOBS = new Set(["Director", "Writer", "Screenplay", "Story"]);

const MAX_CAST = 20;
const MAX_RECS = 12;
const MAX_VIDEOS = 6;

/**
 * Slim a full TMDB title payload down to only what we render/embed, before
 * storing it. Keeps the TmdbTitleDetail shape (so consumers are unchanged) but
 * caps the heavy collections — cast/crew, recommendations, videos — and limits
 * per-region data (watch providers, certifications) to major markets.
 */
export function slimTitleMetadata(meta: TmdbTitleDetail): TmdbTitleDetail {
  const slim: TmdbTitleDetail = { ...meta };

  if (meta.credits) {
    const cast = (meta.credits.cast ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .slice(0, MAX_CAST)
      .map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profile_path: c.profile_path,
        order: c.order,
      }));
    const crew = (meta.credits.crew ?? [])
      .filter((c) => c.job && KEY_CREW_JOBS.has(c.job))
      .map((c) => ({ id: c.id, name: c.name, job: c.job, department: c.department }));
    slim.credits = { cast, crew };
  }

  if (meta.recommendations) {
    slim.recommendations = {
      results: (meta.recommendations.results ?? []).slice(0, MAX_RECS).map((r) => ({
        id: r.id,
        media_type: r.media_type,
        title: r.title,
        name: r.name,
        poster_path: r.poster_path,
        release_date: r.release_date,
        first_air_date: r.first_air_date,
      })),
    };
  }

  if (meta.videos) {
    slim.videos = {
      results: (meta.videos.results ?? [])
        .filter((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"))
        .slice(0, MAX_VIDEOS)
        .map((v) => ({ key: v.key, site: v.site, type: v.type, official: v.official })),
    };
  }

  if (meta.release_dates?.results) {
    slim.release_dates = {
      results: meta.release_dates.results.filter((r) => KEEP_REGIONS.has(r.iso_3166_1)),
    };
  }
  if (meta.content_ratings?.results) {
    slim.content_ratings = {
      results: meta.content_ratings.results.filter((r) => KEEP_REGIONS.has(r.iso_3166_1)),
    };
  }

  const wp = meta["watch/providers"];
  if (wp?.results) {
    const kept: NonNullable<typeof wp.results> = {};
    for (const region of Object.keys(wp.results)) {
      if (KEEP_REGIONS.has(region)) kept[region] = wp.results[region];
    }
    slim["watch/providers"] = { results: kept };
  }

  return slim;
}
