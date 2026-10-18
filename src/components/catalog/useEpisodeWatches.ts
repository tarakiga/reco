"use client";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";

export interface EpisodeWatches {
  episodes: { season: number; episode: number }[];
}

export function episodeWatchesKey(tvId: number) {
  return ["episode-watches", tvId] as const;
}

/**
 * The signed-in user's watched episodes for one show, fetched in the browser.
 * The season list and the progress bar share this one query, so a tick in the
 * list moves the bar without another request. Never runs when signed out.
 */
export function useEpisodeWatches(tvId: number) {
  const { isSignedIn } = useAuth();
  const signedIn = isSignedIn ?? false;
  const query = useQuery({
    queryKey: episodeWatchesKey(tvId),
    queryFn: () => meFetch<EpisodeWatches>(`/api/v1/me/episodes?tmdbId=${tvId}`),
    enabled: signedIn,
    staleTime: 5 * 60 * 1000,
  });
  return { signedIn, data: signedIn ? query.data : undefined };
}
