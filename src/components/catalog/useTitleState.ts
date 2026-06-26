"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";

interface TitleState { status: string | null; score: number | null; favourite: boolean; signedIn: boolean }

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

export function useRemoveRating(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => meFetch("/api/v1/me/ratings", { method: "DELETE", body: { mediaType, tmdbId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] }),
  });
}

interface DiaryDate {
  id: string;
  watchedOn: string;
}

export function useDiaryDates(mediaType: "movie" | "tv", tmdbId: number) {
  return useQuery({
    queryKey: ["diary-dates", mediaType, tmdbId],
    queryFn: () =>
      meFetch<{ dates: DiaryDate[] }>(`/api/v1/me/diary?mediaType=${mediaType}&tmdbId=${tmdbId}`),
  });
}

export function useLogDiary(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      meFetch("/api/v1/me/diary", { method: "POST", body: { mediaType, tmdbId, date } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary-dates", mediaType, tmdbId] });
      qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] });
    },
  });
}

export function useRemoveDiary(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      meFetch("/api/v1/me/diary", { method: "DELETE", body: { entryId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary-dates", mediaType, tmdbId] });
      qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] });
    },
  });
}

export function useToggleFavourite(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (favourite: boolean) =>
      meFetch("/api/v1/me/favourites", {
        method: favourite ? "PUT" : "DELETE",
        body: { mediaType, tmdbId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] }),
  });
}
