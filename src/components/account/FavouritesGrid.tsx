"use client";
import { useState } from "react";
import Link from "next/link";
import { TitleCard } from "@/components/catalog/TitleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useToggleFavourite } from "@/components/catalog/useTitleState";

export interface FavouriteVM {
  titleId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  href: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
}

function FavouriteCard({ item, onRemoved }: { item: FavouriteVM; onRemoved: (titleId: string) => void }) {
  const toggle = useToggleFavourite(item.mediaType, item.tmdbId);
  const toast = useToast();

  function remove() {
    toggle.mutate(false, {
      onSuccess: () => {
        onRemoved(item.titleId);
        toast({ title: "Removed from favourites", variant: "info" });
      },
      onError: (err) => toast({ title: err.message, variant: "danger" }),
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={remove}
        disabled={toggle.isPending}
        aria-label={`Remove ${item.title} from favourites`}
        className="absolute right-1.5 top-1.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-accent backdrop-blur-sm transition hover:bg-black/80 disabled:opacity-50"
      >
        <span aria-hidden>♥</span>
      </button>
      <TitleCard href={item.href} title={item.title} year={item.year} posterUrl={item.posterUrl} />
    </div>
  );
}

/** Client grid of favourited titles; un-hearting removes the card in place. */
export function FavouritesGrid({ initial }: { initial: FavouriteVM[] }) {
  const [items, setItems] = useState(initial);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No favourites yet"
        description="Tap the heart on any movie or show and it'll be saved here."
        action={
          <Link
            href="/movies"
            className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-text transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Browse movies
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
      {items.map((it) => (
        <FavouriteCard
          key={it.titleId}
          item={it}
          onRemoved={(id) => setItems((xs) => xs.filter((x) => x.titleId !== id))}
        />
      ))}
    </div>
  );
}
