"use client";
import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { meFetch } from "@/lib/me-client";
import { TitleCard } from "@/components/catalog/TitleCard";
import { MatchBadge } from "@/components/catalog/MatchBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";
import { TasteOnboarding } from "@/components/onboarding/TasteOnboarding";
import type { ForYouItem } from "@/services/for-you";

interface FeedResponse { needsMoreRatings: boolean; have?: number; need?: number; items: ForYouItem[] }
const PAGE_SIZE = 24;

export function ForYouGrid() {
  const { isSignedIn } = useAuth();
  const [onboarding, setOnboarding] = useState(false);
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["for-you"],
    queryFn: ({ pageParam }) => meFetch<FeedResponse>(`/api/v1/me/for-you?offset=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.needsMoreRatings || lastPage.items.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  });

  const onboardingModal = onboarding && <TasteOnboarding onClose={() => setOnboarding(false)} />;

  if (isPending) return <PosterGridSkeleton />;

  const first = data?.pages[0];
  if (!first || first.needsMoreRatings) {
    return (
      <>
        <EmptyState
          title="Discover what to watch next"
          description="Build your taste profile and we'll surface movies and shows matched to you."
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
        {onboardingModal}
      </>
    );
  }

  // Flatten pages, de-duping (offset paging can rarely repeat as the pool shifts).
  const seen = new Set<string>();
  const items: ForYouItem[] = [];
  for (const page of data.pages) {
    for (const item of page.items) {
      if (!seen.has(item.titleId)) {
        seen.add(item.titleId);
        items.push(item);
      }
    }
  }

  if (items.length === 0) {
    return (
      <>
        <EmptyState
          title="Nothing to recommend just yet"
          description="Rate a few more titles and your suggestions will fill in."
        />
        {onboardingModal}
      </>
    );
  }

  return (
    <>
      <p className="-mt-3 mb-6 max-w-2xl text-sm leading-relaxed text-text-muted">
        These picks are tuned to your taste. The more movies and shows you rate or add to your
        watchlist, the sharper they get — your suggestions keep refreshing as you go.
      </p>

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {items.map((item) => (
          <div key={item.titleId} className="relative">
            <div className="absolute left-1.5 top-1.5 z-10"><MatchBadge match={item.match} /></div>
            <TitleCard href={item.href} title={item.title} year={item.year} posterUrl={item.posterUrl} />
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        {hasNextPage ? (
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface-raised px-6 text-sm font-medium text-text transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        ) : (
          <p className="text-center text-sm text-text-muted">
            That&apos;s everything matched to you for now — rate a few more titles to unlock fresh picks.
          </p>
        )}
      </div>

      {onboardingModal}
    </>
  );
}
