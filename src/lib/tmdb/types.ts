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
export interface TmdbCrewMember {
  id: number;
  name: string;
  job?: string;
  department?: string;
}
/** /tv/{id}/aggregate_credits — the full series cast across all seasons (with
 *  per-person roles + episode counts), unlike `credits` which is current-season. */
export interface TmdbAggregateRole {
  character?: string;
  episode_count?: number;
}
export interface TmdbAggregateCastMember {
  id: number;
  name: string;
  profile_path?: string | null;
  order?: number;
  total_episode_count?: number;
  roles?: TmdbAggregateRole[];
}
export interface TmdbAggregateCredits {
  cast?: TmdbAggregateCastMember[];
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
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
}
export interface TmdbNamedRef {
  id: number;
  name: string;
}
export interface TmdbNetwork {
  id: number;
  name: string;
  logo_path?: string | null;
}
export interface TmdbSeasonSummary {
  id: number;
  season_number: number;
  name: string;
  episode_count?: number;
  air_date?: string | null;
  poster_path?: string | null;
  overview?: string;
}
export interface TmdbEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
  runtime?: number | null;
  air_date?: string | null;
  still_path?: string | null;
  vote_average?: number;
  guest_stars?: { id: number; name: string; character?: string; profile_path?: string | null }[];
  crew?: { id: number; name: string; job?: string }[];
}
export interface TmdbSeasonDetail {
  id: number;
  season_number: number;
  episodes?: TmdbEpisode[];
}
/** Movie age-rating payload (append_to_response=release_dates). */
export interface TmdbReleaseDates {
  results?: {
    iso_3166_1: string;
    release_dates: { certification?: string; type?: number }[];
  }[];
}
/** TV age-rating payload (append_to_response=content_ratings). */
export interface TmdbContentRatings {
  results?: { iso_3166_1: string; rating?: string }[];
}
export interface TmdbEpisodeBrief {
  air_date?: string | null;
  episode_number?: number;
  season_number?: number;
  name?: string;
  runtime?: number | null;
}
export interface TmdbTitleDetail {
  id: number;
  title?: string;
  name?: string;
  tagline?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  last_air_date?: string;
  status?: string;
  original_language?: string;
  genres?: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  vote_average?: number;
  vote_count?: number;
  // movie-only
  budget?: number;
  revenue?: number;
  belongs_to_collection?: { id: number; name: string; poster_path?: string | null } | null;
  // tv-only
  number_of_seasons?: number;
  number_of_episodes?: number;
  last_episode_to_air?: TmdbEpisodeBrief | null;
  next_episode_to_air?: TmdbEpisodeBrief | null;
  seasons?: TmdbSeasonSummary[];
  created_by?: TmdbNamedRef[];
  networks?: TmdbNetwork[];
  credits?: { cast?: TmdbCastMember[]; crew?: TmdbCrewMember[] };
  videos?: { results?: TmdbVideo[] };
  recommendations?: { results?: TmdbSearchItem[] };
  release_dates?: TmdbReleaseDates;
  content_ratings?: TmdbContentRatings;
  keywords?: { keywords?: { id: number; name: string }[]; results?: { id: number; name: string }[] };
  "watch/providers"?: { results?: Record<string, TmdbWatchProviderRegion> };
}
export interface TmdbPersonDetail {
  id: number;
  name: string;
  biography?: string;
  profile_path?: string | null;
  known_for_department?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  combined_credits?: {
    cast?: (TmdbSearchItem & { character?: string; episode_count?: number })[];
  };
}
