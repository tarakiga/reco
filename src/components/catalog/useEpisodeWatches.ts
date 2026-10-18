"use client";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";

export interface EpisodeWatches {
  episodes: { season: number; episode: number }[];
}

/**
 * Query key for one user's watched episodes of one show. The Clerk user id is
 * part of the key, so after an account switch (a soft navigation that keeps the
 * QueryClient) the new account never reads the previous account's ticks.
 */
export function episodeWatchesKey(userId: string | null | undefined, tvId: number) {
  return ["episode-watches", userId ?? null, tvId] as const;
}

/**
 * The signed-in user's watched episodes for one show, fetched in the browser.
 * The season list and the progress bar share this one query, so a tick in the
 * list moves the bar without another request. Never runs when signed out.
 * Returns the query key too, so optimistic writes land on the same entry.
 */
export function useEpisodeWatches(tvId: number) {
  const { isSignedIn, userId } = useAuth();
  const signedIn = (isSignedIn ?? false) && !!userId;
  const queryKey = episodeWatchesKey(userId, tvId);
  const query = useQuery({
    queryKey,
    queryFn: () => meFetch<EpisodeWatches>(`/api/v1/me/episodes?tmdbId=${tvId}`),
    enabled: signedIn,
    staleTime: 5 * 60 * 1000,
  });
  return { signedIn, queryKey, data: signedIn ? query.data : undefined };
}
