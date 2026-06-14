import { posterUrl, stillUrl } from "./images";
import type { TmdbTitleDetail, TmdbSeasonDetail } from "./types";

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  year: number | null;
  posterUrl: string | null;
}

export interface EpisodeVM {
  episodeNumber: number;
  name: string;
  overview: string;
  runtime: number | null;
  airDate: string | null;
  stillUrl: string | null;
  voteAverage: number | null;
}

/** Real seasons (specials/season 0 hidden), sorted, mapped for the accordion. */
export function seasonSummaries(meta: TmdbTitleDetail): SeasonSummary[] {
  return (meta.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .map((s) => ({
      seasonNumber: s.season_number,
      name: s.name || `Season ${s.season_number}`,
      episodeCount: s.episode_count ?? 0,
      year: s.air_date && s.air_date.length >= 4 ? Number(s.air_date.slice(0, 4)) : null,
      posterUrl: posterUrl(s.poster_path),
    }));
}

export function toEpisodes(season: TmdbSeasonDetail): EpisodeVM[] {
  return (season.episodes ?? []).map((e) => ({
    episodeNumber: e.episode_number,
    name: e.name || `Episode ${e.episode_number}`,
    overview: e.overview ?? "",
    runtime: e.runtime && e.runtime > 0 ? e.runtime : null,
    airDate: e.air_date || null,
    stillUrl: stillUrl(e.still_path),
    voteAverage: e.vote_average && e.vote_average > 0 ? e.vote_average : null,
  }));
}
