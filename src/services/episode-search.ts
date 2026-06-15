import "server-only";
import { cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { stillUrl } from "@/lib/tmdb/images";
import { searchEpisodes, type EpisodeIndexEntry, type EpisodeMatch } from "@/lib/tmdb/episodes";

async function fetchSeason(tvId: number, n: number) {
  try {
    return await tmdb.season(tvId, n);
  } catch {
    try {
      return await tmdb.season(tvId, n); // one retry — transient TMDB hiccups / rate limits
    } catch {
      return null;
    }
  }
}

/** All episodes of a show flattened with guest stars + characters + crew, cached per show. */
async function episodeIndex(tvId: number): Promise<EpisodeIndexEntry[]> {
  "use cache";
  cacheTag(`tv-episode-index:${tvId}`);
  const detail = await tmdb.getTitle("tv", tvId);
  const nums = (detail.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .map((s) => s.season_number);
  const seasons = await Promise.all(nums.map((n) => fetchSeason(tvId, n)));

  // Never cache a partial index: if a season failed even after retry, throw so the
  // result isn't cached and the next request rebuilds — otherwise an incomplete
  // index would be served indefinitely (the "ann turkel → only 1 of 3" bug).
  if (seasons.some((s) => s === null)) {
    throw new Error("incomplete episode index");
  }

  const out: EpisodeIndexEntry[] = [];
  for (const s of seasons) {
    if (!s) continue;
    for (const e of s.episodes ?? []) {
      out.push({
        seasonNumber: s.season_number,
        episodeNumber: e.episode_number,
        name: e.name || `Episode ${e.episode_number}`,
        overview: e.overview ?? "",
        runtime: e.runtime && e.runtime > 0 ? e.runtime : null,
        airDate: e.air_date || null,
        stillUrl: stillUrl(e.still_path),
        voteAverage: e.vote_average && e.vote_average > 0 ? e.vote_average : null,
        cast: [], // finder results don't render the cast grid
        guestStars: (e.guest_stars ?? []).map((g) => g.name),
        characters: (e.guest_stars ?? []).map((g) => g.character).filter((c): c is string => !!c),
        crew: (e.crew ?? []).map((c) => c.name),
      });
    }
  }
  return out;
}

export async function findEpisodes(tvId: number, query: string): Promise<EpisodeMatch[]> {
  const index = await episodeIndex(tvId);
  return searchEpisodes(index, query);
}
