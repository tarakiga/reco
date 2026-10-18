"use client";
import { useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";
import { withCardKey, type CardKeyKind, type CardKeys } from "@/lib/card-keys";

/** Prefix of every card-keys query. Invalidate it after any change that can
 *  move a title in or out of the favourites, watchlist or watched sets. */
export const CARD_KEYS_QUERY_PREFIX = ["me", "card-keys"] as const;

export type CardKeysStatus = "loading" | "anonymous" | "ready";

export interface UseCardKeys {
  status: CardKeysStatus;
  has(kind: CardKeyKind, key: string): boolean;
  setKey(kind: CardKeyKind, key: string, on: boolean): void;
}

const STALE_TIME_MS = 5 * 60 * 1000;

/**
 * The signed-in user's card marks (hearts, bookmarks, watched), fetched once in
 * the browser and shared by every card through React Query. Catalog pages are
 * cached for everyone, so the server never fills these in. The user id is part
 * of the query key, so switching accounts never shows the previous account's
 * marks.
 */
export function useCardKeys(): UseCardKeys {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const signedIn = isLoaded && !!isSignedIn && !!userId;
  const queryKey = useMemo(() => [...CARD_KEYS_QUERY_PREFIX, userId ?? null] as const, [userId]);

  const query = useQuery({
    queryKey,
    queryFn: () => meFetch<CardKeys>("/api/v1/me/card-keys"),
    enabled: signedIn,
    staleTime: STALE_TIME_MS,
  });

  const data = signedIn ? query.data : undefined;
  const sets = useMemo(
    () =>
      data
        ? {
            favourites: new Set(data.favourites),
            watchlist: new Set(data.watchlist),
            watched: new Set(data.watched),
          }
        : null,
    [data],
  );

  const status: CardKeysStatus = !isLoaded
    ? "loading"
    : !signedIn
      ? "anonymous"
      : sets
        ? "ready"
        : "loading";

  const has = useCallback(
    (kind: CardKeyKind, key: string) => (sets ? sets[kind].has(key) : false),
    [sets],
  );

  const setKey = useCallback(
    (kind: CardKeyKind, key: string, on: boolean) => {
      if (!queryClient.getQueryData<CardKeys>(queryKey)) return;
      // Drop any refetch in flight: it was sent before this change and would
      // land on top of it. Cancelling reverts the cache synchronously to the
      // data from before that refetch, so the update below sticks.
      void queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<CardKeys>(queryKey, (old) =>
        old ? withCardKey(old, kind, key, on) : old,
      );
    },
    [queryClient, queryKey],
  );

  return { status, has, setKey };
}
