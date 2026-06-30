"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OnboardingPoster } from "./OnboardingPoster";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PickCard } from "@/lib/onboarding/picks";
import type { SearchResult } from "@/lib/tmdb/transform";

const titleKey = (mt: string, id: number) => `${mt}:${id}`;
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

export function OnboardingTitleStep({
  genres, likes, onToggleLike,
}: {
  genres: number[]; likes: Set<string>; onToggleLike: (key: string, card: PickCard) => void;
}) {
  const [q, setQ] = useState("");
  const isSearching = q.trim().length > 1;

  const picksQuery = useQuery({
    queryKey: ["onboarding-picks", genres.join(",")],
    queryFn: () =>
      fetch(`/api/v1/onboarding/picks?genres=${genres.join(",")}`).then((r) => r.json() as Promise<{ picks: PickCard[] }>),
    enabled: genres.length > 0,
  });
  const searchQuery = useQuery({
    queryKey: ["onboarding-search", q],
    enabled: isSearching,
    queryFn: () =>
      fetch(`/api/v1/search?q=${encodeURIComponent(q.trim())}`).then((r) => r.json() as Promise<{ results: SearchResult[] }>),
  });

  const active = isSearching ? searchQuery : picksQuery;
  const cards: PickCard[] = isSearching
    ? (searchQuery.data?.results ?? [])
        .filter((r): r is Extract<SearchResult, { kind: "title" }> => r.kind === "title")
        .map((r) => ({ tmdbId: r.tmdbId, mediaType: r.mediaType, title: r.title, year: r.year, posterUrl: r.posterUrl }))
    : (picksQuery.data?.picks ?? []);

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a specific favorite…"
        aria-label="Search titles"
        className="mb-4 h-10 w-full max-w-sm rounded-md border border-border bg-surface-raised px-3 text-sm text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
      />

      {active.isPending ? (
        <div className={GRID} aria-hidden="true">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="aspect-2/3 w-full rounded-lg" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-muted">
          {isSearching ? (
            <>No results for &ldquo;{q.trim()}&rdquo;.</>
          ) : (
            <>
              Couldn&apos;t load suggestions.{" "}
              <button type="button" onClick={() => picksQuery.refetch()} className="text-accent-text underline underline-offset-2 hover:text-accent-text">
                Try again
              </button>{" "}
              or search for a favorite above.
            </>
          )}
        </p>
      ) : (
        <div className={GRID}>
          {cards.map((card) => {
            const key = titleKey(card.mediaType, card.tmdbId);
            return (
              <OnboardingPoster
                key={key}
                title={card.title}
                year={card.year}
                posterUrl={card.posterUrl}
                selected={likes.has(key)}
                onClick={() => onToggleLike(key, card)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
