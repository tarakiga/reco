import "server-only";
import { cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { stillUrl } from "@/lib/tmdb/images";
import { searchEpisodes, type EpisodeIndexEntry, type EpisodeMatch } from "@/lib/tmdb/episodes";

/** All episodes of a show flattened with guest stars + crew, cached per show. */
async function episodeIndex(tvId: number): Promise<EpisodeIndexEntry[]> {
  "use cache";
  cacheTag(`tv-episode-index:${tvId}`);
  const detail = await tmdb.getTitle("tv", tvId);
  const nums = (detail.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .map((s) => s.season_number);
  const seasons = await Promise.all(nums.map((n) => tmdb.season(tvId, n).catch(() => null)));

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
        guestStars: (e.guest_stars ?? []).map((g) => g.name),
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
