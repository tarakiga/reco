"use client";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";
import { CARD_KEYS_QUERY_PREFIX } from "./useCardKeys";

/** Shared key for every mutation that can change the current user's card marks
 *  (favourites, watchlist, ratings and diary, which feed "watched"). */
const CARD_KEY_WRITES = ["me", "card-key-write"] as const;

/**
 * Refetch the card keys only once the last overlapping card-key write is done.
 * A refetch that starts while another write is in flight would return server
 * state without that write and wipe its optimistic mark. Called from a
 * mutation's own onSuccess, which React Query runs while that mutation is
 * still pending, so the finishing mutation counts itself here.
 */
function invalidateCardKeysWhenIdle(qc: QueryClient) {
  if (qc.isMutating({ mutationKey: CARD_KEY_WRITES }) <= 1) {
    qc.invalidateQueries({ queryKey: CARD_KEYS_QUERY_PREFIX });
  }
}

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
    mutationKey: CARD_KEY_WRITES,
    mutationFn: (status: string) =>
      meFetch("/api/v1/me/watchlist", { method: "PUT", body: { mediaType, tmdbId, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] });
      invalidateCardKeysWhenIdle(qc);
    },
  });
}

export function useRemoveWatch(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CARD_KEY_WRITES,
    mutationFn: () => meFetch("/api/v1/me/watchlist", { method: "DELETE", body: { mediaType, tmdbId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] });
      invalidateCardKeysWhenIdle(qc);
    },
  });
}

export function useSetRating(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CARD_KEY_WRITES,
    mutationFn: (score: number) =>
      meFetch("/api/v1/me/ratings", { method: "PUT", body: { mediaType, tmdbId, score } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] });
      invalidateCardKeysWhenIdle(qc);
    },
  });
}

export function useRemoveRating(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CARD_KEY_WRITES,
    mutationFn: () => meFetch("/api/v1/me/ratings", { method: "DELETE", body: { mediaType, tmdbId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] });
      invalidateCardKeysWhenIdle(qc);
    },
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
    mutationKey: CARD_KEY_WRITES,
    mutationFn: (date: string) =>
      meFetch("/api/v1/me/diary", { method: "POST", body: { mediaType, tmdbId, date } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary-dates", mediaType, tmdbId] });
      qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] });
      invalidateCardKeysWhenIdle(qc);
    },
  });
}

export function useRemoveDiary(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CARD_KEY_WRITES,
    mutationFn: (entryId: string) =>
      meFetch("/api/v1/me/diary", { method: "DELETE", body: { entryId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary-dates", mediaType, tmdbId] });
      qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] });
      invalidateCardKeysWhenIdle(qc);
    },
  });
}

export function useToggleFavourite(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CARD_KEY_WRITES,
    mutationFn: (favourite: boolean) =>
      meFetch("/api/v1/me/favourites", {
        method: favourite ? "PUT" : "DELETE",
        body: { mediaType, tmdbId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] });
      invalidateCardKeysWhenIdle(qc);
    },
  });
}
