import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { posterUrl } from "@/lib/tmdb/images";
import { listWatchlist } from "./user-catalog";

export interface EpgEntry {
  tvId: number;
  showTitle: string;
  posterUrl: string | null;
  href: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string | null;
  episodeOverview: string | null;
  /** YYYY-MM-DD (TMDB air date). */
  airDate: string;
}

interface NextEp {
  seasonNumber: number;
  episodeNumber: number;
  name: string | null;
  overview: string | null;
  airDate: string;
}

/** Next upcoming episode for one show, from TMDB. Cached ~hours per show (shared
 *  across users) and tagged so it can be revalidated. Null when nothing is scheduled. */
async function nextEpisode(tvId: number): Promise<NextEp | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`epg-show:${tvId}`);
  try {
    const n = (await tmdb.tvAiring(tvId)).next_episode_to_air;
    if (!n?.air_date) return null;
    return {
      seasonNumber: n.season_number ?? 0,
      episodeNumber: n.episode_number ?? 0,
      name: n.name ?? null,
      overview: n.overview?.trim() ? n.overview.trim() : null,
      airDate: n.air_date,
    };
  } catch {
    return null;
  }
}

/**
 * A user's personalised EPG: the next upcoming episode for every TV show on
 * their watchlist, sorted by air date. TMDB-only, so it's free and network-agnostic.
 */
export async function getEpg(userId: string): Promise<EpgEntry[]> {
  const tv = (await listWatchlist(userId)).filter((w) => w.mediaType === "tv");
  const entries = await Promise.all(
    tv.map(async (s): Promise<EpgEntry | null> => {
      const ne = await nextEpisode(s.tmdbId);
      if (!ne) return null;
      return {
        tvId: s.tmdbId,
        showTitle: s.title,
        posterUrl: posterUrl(s.posterPath),
        href: `/title/tv/${s.tmdbId}-${s.slug}`,
        seasonNumber: ne.seasonNumber,
        episodeNumber: ne.episodeNumber,
        episodeName: ne.name,
        episodeOverview: ne.overview,
        airDate: ne.airDate,
      };
    }),
  );
  return entries
    .filter((e): e is EpgEntry => e !== null)
    .sort((a, b) => a.airDate.localeCompare(b.airDate));
}
