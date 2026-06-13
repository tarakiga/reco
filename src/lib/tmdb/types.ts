export interface TmdbSearchItem {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string; // movie
  name?: string; // tv / person
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  profile_path?: string | null;
  overview?: string;
  known_for_department?: string;
}
export interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
}
export interface TmdbVideo {
  key: string;
  site: string; // "YouTube"
  type: string; // "Trailer"
  official?: boolean;
}
export interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
}
export interface TmdbWatchProviderRegion {
  link?: string;
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
}
export interface TmdbTitleDetail {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genres?: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  vote_average?: number;
  credits?: { cast?: TmdbCastMember[] };
  videos?: { results?: TmdbVideo[] };
  "watch/providers"?: { results?: Record<string, TmdbWatchProviderRegion> };
}
export interface TmdbPersonDetail {
  id: number;
  name: string;
  biography?: string;
  profile_path?: string | null;
  known_for_department?: string;
  combined_credits?: {
    cast?: (TmdbSearchItem & { character?: string })[];
  };
}
