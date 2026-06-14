"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { meFetch } from "@/lib/me-client";
import { TitleCard } from "@/components/catalog/TitleCard";
import { MatchBadge } from "@/components/catalog/MatchBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";
import { TasteOnboarding } from "@/components/onboarding/TasteOnboarding";
import type { ForYouItem } from "@/services/for-you";

interface FeedResponse { needsMoreRatings: boolean; have?: number; need?: number; items: ForYouItem[] }

export function ForYouGrid() {
  const { isSignedIn } = useAuth();
  const [onboarding, setOnboarding] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["for-you"],
    queryFn: () => meFetch<FeedResponse>("/api/v1/me/for-you"),
  });

  if (isLoading) return <PosterGridSkeleton />;
  if (!data || data.needsMoreRatings) {
    return (
      <>
        <EmptyState
          title="Discover what to watch next"
          description={`Build your taste profile and we'll surface movies and shows matched to you.`}
          action={
            isSignedIn === false ? (
              <Link href="/sign-in" className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-text hover:bg-accent-hover">
                Sign in to get started
              </Link>
            ) : (
              <button type="button" onClick={() => setOnboarding(true)} className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-text hover:bg-accent-hover">
                Build your taste profile
              </button>
            )
          }
        />
        {onboarding && <TasteOnboarding onClose={() => setOnboarding(false)} />}
      </>
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
