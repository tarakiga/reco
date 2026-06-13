"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";

interface TitleState { status: string | null; score: number | null; signedIn: boolean }

export function useTitleState(mediaType: "movie" | "tv", tmdbId: number) {
  return useQuery({
    queryKey: ["title-state", mediaType, tmdbId],
    queryFn: () =>
      meFetch<TitleState>(`/api/v1/me/title-state?mediaType=${mediaType}&tmdbId=${tmdbId}`),
  });
}

export function useSetWatch(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) =>
      meFetch("/api/v1/me/watchlist", { method: "PUT", body: { mediaType, tmdbId, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] }),
  });
}

export function useRemoveWatch(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => meFetch("/api/v1/me/watchlist", { method: "DELETE", body: { mediaType, tmdbId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] }),
  });
}

export function useSetRating(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (score: number) =>
      meFetch("/api/v1/me/ratings", { method: "PUT", body: { mediaType, tmdbId, score } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] }),
  });
}
