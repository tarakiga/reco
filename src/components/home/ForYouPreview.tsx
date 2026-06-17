"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { meFetch } from "@/lib/me-client";
import { Rail } from "@/components/catalog/Rail";
import { TitleCard } from "@/components/catalog/TitleCard";
import { MatchBadge } from "@/components/catalog/MatchBadge";
import type { ForYouItem } from "@/services/for-you";

type FeedItem = ForYouItem & { favourite?: boolean; watchlist?: boolean };
interface FeedResponse {
  needsMoreRatings: boolean;
  items: FeedItem[];
}

/** A slim, personalized rail on the home page. Shows the top taste-matched picks
 *  when the profile is warm; otherwise a one-line nudge into the taste flow. */
export function ForYouPreview() {
  const { isSignedIn } = useAuth();
  const { data, isPending } = useQuery({
    queryKey: ["for-you", "preview"],
    queryFn: () => meFetch<FeedResponse>("/api/v1/me/for-you?offset=0"),
    enabled: isSignedIn !== false,
  });

  // Signed out, still loading, or not enough ratings → a quiet nudge (no empty rail).
  if (isSignedIn === false || isPending || data?.needsMoreRatings || !data?.items.length) {
    if (isSignedIn === undefined || isPending) return null; // avoid fl/pop-in before auth resolves
    return (
      <section className="mb-8 rounded-xl border border-border bg-surface-raised p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-text">Get picks tuned to you</h2>
        <p className="mt-1 max-w-xl text-sm text-text-muted">
          Tell us a few movies and shows you love and we&apos;ll build a feed matched to your taste.
        </p>
        <Link
          href="/for-you"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-text transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {isSignedIn === false ? "Get started" : "Build your taste profile"}
        </Link>
      </section>
    );
  }

  const items = data.items.slice(0, 12);
  return (
    <Rail
      title="For you"
      action={
        <Link href="/for-you" className="text-sm font-medium text-accent hover:underline">
          See all
        </Link>
      }
    >
      {items.map((item) => (
        <div key={item.titleId} className="relative w-32 shrink-0">
          <div className="absolute left-1.5 top-1.5 z-10">
            <MatchBadge match={item.match} />
          </div>
          <TitleCard
            href={item.href}
            title={item.title}
            year={item.year}
            posterUrl={item.posterUrl}
            favourite={{ mediaType: item.mediaType, tmdbId: item.tmdbId, initial: item.favourite ?? false, signedIn: true }}
            watchlist={{ mediaType: item.mediaType, tmdbId: item.tmdbId, initial: item.watchlist ?? false, signedIn: true }}
          />
        </div>
      ))}
    </Rail>
  );
}
