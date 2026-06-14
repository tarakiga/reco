"use client";
import { useQuery } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";

/** Fetch match% for a set of title ids (shared query so a page batches once). */
export function useMatches(titleIds: string[]) {
  const key = [...titleIds].sort().join(",");
  return useQuery({
    queryKey: ["match", key],
    enabled: titleIds.length > 0,
    queryFn: () =>
      meFetch<{ match: Record<string, number> }>(
        `/api/v1/me/match?titleIds=${encodeURIComponent(titleIds.join(","))}`,
      )
        .then((r) => r.match)
        .catch(() => ({})),
    staleTime: 5 * 60 * 1000,
  });
}
