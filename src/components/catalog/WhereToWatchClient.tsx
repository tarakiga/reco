"use client";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import { WhereToWatchView } from "./WhereToWatchView";

/**
 * Client island: fetches the signed-in user's region (defaulting to "US" when
 * signed out or while loading), then renders WhereToWatchView.
 * Keeps the title detail page PPR-cacheable — region resolution is client-side.
 *
 * The region query only runs once Clerk confirms a signed-in session, so
 * anonymous visitors default to "US" without firing an unauthorized
 * /api/v1/me/profile request (which would 401 and pollute the console/monitoring).
 */
export function WhereToWatchClient({
  watch,
}: {
  watch: TmdbTitleDetail["watch/providers"] | undefined;
}) {
  const { isSignedIn } = useAuth();
  const { data: region = "US" } = useQuery({
    queryKey: ["me-region"],
    enabled: isSignedIn === true,
    queryFn: () =>
      meFetch<{ region?: string }>("/api/v1/me/profile")
        .then((r) => r.region ?? "US")
        .catch(() => "US"),
    staleTime: 5 * 60 * 1000,
  });

  return <WhereToWatchView watch={watch} region={region} />;
}
