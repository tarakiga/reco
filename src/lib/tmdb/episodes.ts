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
  /** How many votes back the average — used to weight the "top rated" ranking. */
  voteCount: number | null;
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
    voteCount: e.vote_count && e.vote_count > 0 ? e.vote_count : null,
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
  /** Present only on AI fallback guesses: the model's one-line rationale. */
  aiReason?: string;
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

/** A single ranked "best of" episode — a slim shape for the top-rated panel. */
export interface TopEpisode {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  stillUrl: string | null;
  voteAverage: number | null;
  voteCount: number | null;
}

/**
 * Rank a show's episodes so genuinely-loved ones rise and a lone 10/10 with two
 * votes doesn't top the list. Only rated episodes qualify, and they must clear a
 * minimum-vote gate (IMDb-style) that adapts to the show — a fraction of the
 * median vote count, clamped to [5, 50] so it filters true flukes without
 * excluding legitimately-voted episodes. If nothing clears the gate (a sparse
 * show), we fall back to every rated episode. Then sort by average, most-voted
 * first on ties.
 */
export function rankTopEpisodes(entries: EpisodeIndexEntry[], limit = 10): TopEpisode[] {
  const rated = entries.filter((e) => e.voteAverage != null && (e.voteCount ?? 0) > 0);
  if (rated.length === 0) return [];

  const counts = rated.map((e) => e.voteCount as number).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)];
  const gate = Math.max(5, Math.min(Math.round(median * 0.2), 50));

  let pool = rated.filter((e) => (e.voteCount as number) >= gate);
  if (pool.length === 0) pool = rated;

  return pool
    .sort((a, b) => (b.voteAverage as number) - (a.voteAverage as number) || (b.voteCount ?? 0) - (a.voteCount ?? 0))
    .slice(0, limit)
    .map((e) => ({
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      name: e.name,
      overview: e.overview,
      airDate: e.airDate,
      stillUrl: e.stillUrl,
      voteAverage: e.voteAverage,
      voteCount: e.voteCount,
    }));
}
