"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useToggleFavourite } from "./useTitleState";
import type { CardFavourite } from "@/lib/favourite";

/**
 * Heart overlay for grid cards — favourite without opening the title. Sits
 * inside the card's <Link>, so it stops the click from navigating. Optimistic:
 * flips immediately, reverts on error. Signed-out users are nudged to sign in.
 */
export function CardFavouriteButton({ mediaType, tmdbId, initial, signedIn }: CardFavourite) {
  const router = useRouter();
  const toast = useToast();
  const toggle = useToggleFavourite(mediaType, tmdbId);
  const [fav, setFav] = useState(initial);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push("/sign-in");
      return;
    }
    const next = !fav;
    setFav(next);
    toggle.mutate(next, {
      onSuccess: () =>
        toast({
          title: next ? "Added to favourites" : "Removed from favourites",
          variant: next ? "success" : "info",
        }),
      onError: (err) => {
        setFav(!next); // revert optimistic flip
        toast({ title: err.message, variant: "danger" });
      },
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggle.isPending}
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
