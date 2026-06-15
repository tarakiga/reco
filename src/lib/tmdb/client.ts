import "server-only";
import type { TmdbPersonDetail, TmdbTitleDetail, TmdbSearchItem, TmdbSeasonDetail } from "./types";

const BASE = "https://api.themoviedb.org/3";

export class TmdbError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function apiKey(): string {
  const k = process.env.TMDB_API_KEY;
  if (!k) throw new TmdbError(500, "TMDB_API_KEY is not configured");
  return k;
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", apiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new TmdbError(res.status, `TMDB ${path} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const tmdb = {
  searchMulti: (query: string, page = 1) =>
    get<{ results: TmdbSearchItem[]; total_results: number }>("/search/multi", {
      query,
      page: String(page),
      include_adult: "false",
    }),
  getTitle: (mediaType: "movie" | "tv", id: number) =>
    get<TmdbTitleDetail>(`/${mediaType}/${id}`, {
      append_to_response: [
        "credits",
        "videos",
        "watch/providers",
        "recommendations",
        "keywords",
        mediaType === "movie" ? "release_dates" : "content_ratings",
      ].join(","),
    }),
  getPerson: (id: number) =>
    get<TmdbPersonDetail>(`/person/${id}`, { append_to_response: "combined_credits" }),
  season: (tvId: number, seasonNumber: number) =>
    get<TmdbSeasonDetail>(`/tv/${tvId}/season/${seasonNumber}`),
  // Lightweight TV fetch for airing data (next_episode_to_air) — no append_to_response.
  tvAiring: (id: number) => get<TmdbTitleDetail>(`/tv/${id}`),
  externalIds: (mediaType: "movie" | "tv", id: number) =>
    get<{ wikidata_id?: string | null; imdb_id?: string | null }>(`/${mediaType}/${id}/external_ids`),
  personExternalIds: (id: number) =>
    get<{ wikidata_id?: string | null; imdb_id?: string | null }>(`/person/${id}/external_ids`),
  titleBrief: (mediaType: "movie" | "tv", id: number) =>
    get<{ title?: string; name?: string; poster_path?: string | null; release_date?: string; first_air_date?: string }>(
      `/${mediaType}/${id}`,
    ),
  collection: (id: number) =>
    get<{ id: number; name: string; parts?: { id: number; title?: string; poster_path?: string | null; release_date?: string }[] }>(
      `/collection/${id}`,
    ),
  trending: () => get<{ results: TmdbSearchItem[] }>("/trending/all/week"),
  popular: (mediaType: "movie" | "tv", page = 1) =>
    get<{ results: TmdbSearchItem[] }>(`/${mediaType}/popular`, { page: String(page) }),
  nowPlaying: (page = 1) =>
    get<{ results: TmdbSearchItem[] }>("/movie/now_playing", { page: String(page) }),
  discover: (mediaType: "movie" | "tv", params: Record<string, string>) =>
    get<{ results: TmdbSearchItem[]; total_pages: number }>(`/discover/${mediaType}`, params),
  genres: (mediaType: "movie" | "tv") =>
    get<{ genres: { id: number; name: string }[] }>(`/genre/${mediaType}/list`),
  watchProviders: (mediaType: "movie" | "tv", region: string) =>
    get<{ results: { provider_id: number; provider_name: string; logo_path: string | null; display_priorities?: Record<string, number>; display_priority?: number }[] }>(
      `/watch/providers/${mediaType}`,
      { watch_region: region },
    ),
  watchRegions: () =>
    get<{ results: { iso_3166_1: string; english_name: string }[] }>("/watch/providers/regions"),
};
