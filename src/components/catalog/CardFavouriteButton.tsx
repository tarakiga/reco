"use client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { cardKey } from "@/lib/card-keys";
import type { CardFavourite } from "@/lib/favourite";
import { useCardKeys } from "./useCardKeys";
import { useToggleFavourite } from "./useTitleState";

/**
 * Heart overlay for grid cards. Favourite without opening the title. Sits
 * inside the card's <Link>, so it stops the click from navigating. The state
 * comes from the browser-side card keys. Optimistic: flips immediately,
 * reverts on error. Signed-out users are nudged to sign in.
 */
export function CardFavouriteButton({ mediaType, tmdbId }: CardFavourite) {
  const router = useRouter();
  const toast = useToast();
  const toggle = useToggleFavourite(mediaType, tmdbId);
  const keys = useCardKeys();
  const key = cardKey(mediaType, tmdbId);
  const fav = keys.has("favourites", key);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (keys.status === "loading") return;
    if (keys.status === "anonymous") {
      router.push("/sign-in");
      return;
    }
    const next = !fav;
    keys.setKey("favourites", key, next);
    toggle.mutate(next, {
      onSuccess: () =>
        toast({
          title: next ? "Added to favourites" : "Removed from favourites",
          variant: next ? "success" : "info",
        }),
      onError: (err) => {
        keys.setKey("favourites", key, !next); // revert optimistic flip
        toast({ title: err.message, variant: "danger" });
      },
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={keys.status === "loading" || toggle.isPending}
      aria-pressed={fav}
      aria-label={fav ? "Remove from favourites" : "Add to favourites"}
      title={fav ? "Remove from favourites" : "Add to favourites"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-lg leading-none backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
    >
      <span aria-hidden className={fav ? "text-accent-text" : "text-white"}>
        {fav ? "♥" : "♡"}
      </span>
    </button>
  );
}
