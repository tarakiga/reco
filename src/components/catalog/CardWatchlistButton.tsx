"use client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { cardKey } from "@/lib/card-keys";
import type { CardWatchlist } from "@/lib/favourite";
import { useCardKeys } from "./useCardKeys";
import { useSetWatch, useRemoveWatch } from "./useTitleState";

/**
 * Bookmark overlay for grid/search cards. Adds to the watchlist (as "want to
 * watch") without opening the title. The state comes from the browser-side
 * card keys. Optimistic, stops the card link from navigating, nudges
 * signed-out users to sign in.
 */
export function CardWatchlistButton({ mediaType, tmdbId }: CardWatchlist) {
  const router = useRouter();
  const toast = useToast();
  const setWatch = useSetWatch(mediaType, tmdbId);
  const removeWatch = useRemoveWatch(mediaType, tmdbId);
  const keys = useCardKeys();
  const key = cardKey(mediaType, tmdbId);
  const on = keys.has("watchlist", key);
  const pending = keys.status === "loading" || setWatch.isPending || removeWatch.isPending;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (keys.status === "loading") return;
    if (keys.status === "anonymous") {
      router.push("/sign-in");
      return;
    }
    const next = !on;
    keys.setKey("watchlist", key, next);
    if (next) {
      setWatch.mutate("want_to_watch", {
        onSuccess: () => toast({ title: "Added to watchlist", variant: "success" }),
        onError: (err) => {
          keys.setKey("watchlist", key, false);
          toast({ title: err.message, variant: "danger" });
        },
      });
    } else {
      removeWatch.mutate(undefined, {
        onSuccess: () => toast({ title: "Removed from watchlist", variant: "info" }),
        onError: (err) => {
          keys.setKey("watchlist", key, true);
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
