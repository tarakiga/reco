import "server-only";
import type { TmdbPersonDetail, TmdbTitleDetail, TmdbSearchItem } from "./types";

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
      append_to_response: "credits,videos,watch/providers",
    }),
  getPerson: (id: number) =>
    get<TmdbPersonDetail>(`/person/${id}`, { append_to_response: "combined_credits" }),
  trending: () => get<{ results: TmdbSearchItem[] }>("/trending/all/week"),
  discover: (mediaType: "movie" | "tv", params: Record<string, string>) =>
    get<{ results: TmdbSearchItem[]; total_pages: number }>(`/discover/${mediaType}`, params),
  genres: (mediaType: "movie" | "tv") =>
    get<{ genres: { id: number; name: string }[] }>(`/genre/${mediaType}/list`),
};
