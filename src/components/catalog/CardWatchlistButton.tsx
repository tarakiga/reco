"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useSetWatch, useRemoveWatch } from "./useTitleState";
import type { CardWatchlist } from "@/lib/favourite";

/**
 * Bookmark overlay for grid/search cards — add to the watchlist (as "want to
 * watch") without opening the title. Optimistic, stops the card link from
 * navigating, nudges signed-out users to sign in.
 */
export function CardWatchlistButton({ mediaType, tmdbId, initial, signedIn }: CardWatchlist) {
  const router = useRouter();
  const toast = useToast();
  const setWatch = useSetWatch(mediaType, tmdbId);
  const removeWatch = useRemoveWatch(mediaType, tmdbId);
  const [on, setOn] = useState(initial);
  const pending = setWatch.isPending || removeWatch.isPending;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push("/sign-in");
      return;
    }
    const next = !on;
    setOn(next);
    if (next) {
      setWatch.mutate("want_to_watch", {
        onSuccess: () => toast({ title: "Added to watchlist", variant: "success" }),
        onError: (err) => {
          setOn(false);
          toast({ title: err.message, variant: "danger" });
        },
      });
    } else {
      removeWatch.mutate(undefined, {
        onSuccess: () => toast({ title: "Removed from watchlist", variant: "info" }),
        onError: (err) => {
          setOn(true);
          toast({ title: err.message, variant: "danger" });
        },
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? "Remove from watchlist" : "Add to watchlist"}
      title={on ? "Remove from watchlist" : "Add to watchlist"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
    >
      {on ? (
        <svg viewBox="0 0 24 24" className="size-4 text-accent-text" fill="currentColor" aria-hidden="true">
          <path d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1Z" />
          <path d="m10.5 11 1.6 1.6L15 9.8" fill="none" stroke="#0b0d12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1Z" />
          <path d="M12 7v5M9.5 9.5h5" />
        </svg>
      )}
    </button>
  );
}
