"use client";
import { useQuery } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";
import { TitleCard } from "@/components/catalog/TitleCard";
import { MatchBadge } from "@/components/catalog/MatchBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";
import type { ForYouItem } from "@/services/for-you";

interface FeedResponse { needsMoreRatings: boolean; have?: number; need?: number; items: ForYouItem[] }

export function ForYouGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ["for-you"],
    queryFn: () => meFetch<FeedResponse>("/api/v1/me/for-you"),
  });

  if (isLoading) return <PosterGridSkeleton />;
  if (!data || data.needsMoreRatings) {
    return (
      <EmptyState
        title="Rate a few titles to unlock your matches"
        description={`Rate at least ${data?.need ?? 5} movies or shows and we'll build your taste profile.`}
      />
    );
  }
  if (data.items.length === 0) {
    return <EmptyState title="Nothing to recommend yet" description="Check back as your taste profile grows." />;
  }
  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
      {data.items.map((item) => (
        <div key={item.titleId} className="relative">
          <div className="absolute left-1.5 top-1.5 z-10"><MatchBadge match={item.match} /></div>
          <TitleCard href={item.href} title={item.title} year={item.year} posterUrl={item.posterUrl} />
        </div>
      ))}
    </div>
  );
}
