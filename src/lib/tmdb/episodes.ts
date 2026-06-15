import { slugify } from "@/lib/slug";
import { posterUrl, stillUrl, profileUrl } from "./images";
import type { TmdbTitleDetail, TmdbSeasonDetail } from "./types";

export interface EpisodeCastMember {
  id: number;
  name: string;
  character: string | null;
  profileUrl: string | null;
  href: string;
}

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
  /** Per-episode guest cast (with photos) — the regulars live in the show Cast. */
  cast: EpisodeCastMember[];
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
    cast: (e.guest_stars ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      character: g.character || null,
      profileUrl: profileUrl(g.profile_path),
      href: `/person/${g.id}-${slugify(g.name)}`,
    })),
  }));
}

/** One episode flattened across the whole series, with searchable people. */
export interface EpisodeIndexEntry extends EpisodeVM {
  seasonNumber: number;
  guestStars: string[];
  /** Characters played by guest stars in this episode (searchable by role). */
  characters: string[];
  crew: string[];
}

export interface EpisodeMatch extends EpisodeIndexEntry {
  /** Human-readable reason, e.g. "Guest: Brad Pitt", or null for title/overview hits. */
  matchedOn: string | null;
}

// Filler words that wrap a query intent ("the episode with …", "show me …") and
// shouldn't be required matches. Kept deliberately small so real plot words stay.
const EPISODE_STOP_WORDS = new Set([
  "episode", "episodes", "ep", "eps", "the", "a", "an", "with", "where", "that",
  "this", "in", "of", "on", "about", "find", "show", "me", "season", "guest",
  "starring", "featuring", "appears", "appeared", "who",
]);

/**
 * Rank episodes against a free-text query over title + overview + guest stars +
 * crew. AND semantics (every query word must appear somewhere), with boosts for
 * phrase hits in names/guest stars so "brad pitt" surfaces his guest episode.
 */
export function searchEpisodes(
  entries: EpisodeIndexEntry[],
  query: string,
  limit = 12,
): EpisodeMatch[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  // Strip filler so natural phrasing ("the episode with brad pitt") matches like
  // "brad pitt" — AND-matching shouldn't require the words "episode"/"with"/etc.
  const allWords = q.split(/\s+/).filter(Boolean);
  const kept = allWords.filter((w) => !EPISODE_STOP_WORDS.has(w));
  const words = kept.length > 0 ? kept : allWords; // never strip away every word
  const phrase = words.join(" ");

  const scored: { entry: EpisodeIndexEntry; score: number; matchedOn: string | null }[] = [];
  for (const e of entries) {
    const guestText = e.guestStars.join(" ").toLowerCase();
    const crewText = e.crew.join(" ").toLowerCase();
    const charText = e.characters.join(" ").toLowerCase();
    const name = e.name.toLowerCase();
    const hay = `${name} ${e.overview.toLowerCase()} ${guestText} ${charText} ${crewText}`;
    if (!words.every((w) => hay.includes(w))) continue;

    let score = 1;
    if (phrase && hay.includes(phrase)) score += 1;
    if (phrase && name.includes(phrase)) score += 3;
    const person =
      e.guestStars.find((g) => words.every((w) => g.toLowerCase().includes(w))) ??
      e.crew.find((c) => words.every((w) => c.toLowerCase().includes(w)));
    const character = e.characters.find((c) => words.every((w) => c.toLowerCase().includes(w)));
    let matchedOn: string | null = null;
    if (person) {
      score += 3;
      matchedOn = e.guestStars.includes(person) ? `Guest: ${person}` : `Crew: ${person}`;
    } else if (character) {
      score += 2;
      matchedOn = `As ${character}`;
    }
    scored.push({ entry: e, score, matchedOn });
  }

  scored.sort((a, b) => b.score - a.score || (b.entry.voteAverage ?? 0) - (a.entry.voteAverage ?? 0));
  return scored.slice(0, limit).map((s) => ({ ...s.entry, matchedOn: s.matchedOn }));
}
