"use client";
import { useQuery } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import { WhereToWatchView } from "./WhereToWatchView";

/**
 * Client island: fetches the signed-in user's region (defaulting to "US" when
 * signed out or while loading), then renders WhereToWatchView.
 * Keeps the title detail page PPR-cacheable — region resolution is client-side.
 */
export function WhereToWatchClient({
  watch,
}: {
  watch: TmdbTitleDetail["watch/providers"] | undefined;
}) {
  const { data: region = "US" } = useQuery({
    queryKey: ["me-region"],
    queryFn: () =>
      meFetch<{ region?: string }>("/api/v1/me/profile")
        .then((r) => r.region ?? "US")
        .catch(() => "US"),
    staleTime: 5 * 60 * 1000,
  });

  return <WhereToWatchView watch={watch} region={region} />;
}
