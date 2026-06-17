"use client";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StarRating } from "@/components/ui/StarRating";
import { useToast } from "@/components/ui/Toast";
import {
  useTitleState,
  useSetWatch,
  useRemoveWatch,
  useSetRating,
  useToggleFavourite,
} from "./useTitleState";

interface Props {
  mediaType: "movie" | "tv";
  tmdbId: number;
}

export function TitleActions({ mediaType, tmdbId }: Props) {
  const { data, isLoading } = useTitleState(mediaType, tmdbId);
  const setWatch = useSetWatch(mediaType, tmdbId);
  const removeWatch = useRemoveWatch(mediaType, tmdbId);
  const setRating = useSetRating(mediaType, tmdbId);
  const toggleFavourite = useToggleFavourite(mediaType, tmdbId);
  const toast = useToast();

  if (isLoading) {
    return <Skeleton className="h-10 w-64" />;
  }

  if (!data?.signedIn) {
    return (
      <p className="rounded-md border border-border bg-surface-raised px-4 py-3 text-sm text-text-muted">
        <Link href="/sign-in" className="font-medium text-accent underline underline-offset-2 hover:text-accent/80">
          Sign in
        </Link>{" "}
        to add to your watchlist and rate this title.
      </p>
    );
  }

  const isPending = setWatch.isPending || removeWatch.isPending || setRating.isPending;

  function handleWatchlistChange(value: string) {
    if (value === "") {
      removeWatch.mutate(undefined, {
        onSuccess: () => toast({ title: "Removed from watchlist", variant: "info" }),
        onError: (err) => toast({ title: err.message, variant: "danger" }),
      });
    } else {
      setWatch.mutate(value, {
        onSuccess: () => toast({ title: "Added to watchlist", variant: "success" }),
        onError: (err) => toast({ title: err.message, variant: "danger" }),
      });
    }
  }

  function handleRatingChange(score: number) {
    setRating.mutate(score, {
      onSuccess: () => toast({ title: `Rated ${score} ★`, variant: "success" }),
      onError: (err) => toast({ title: err.message, variant: "danger" }),
    });
  }

  function handleFavouriteToggle() {
    const next = !data!.favourite;
    toggleFavourite.mutate(next, {
      onSuccess: () =>
        toast({ title: next ? "Added to favourites" : "Removed from favourites", variant: next ? "success" : "info" }),
      onError: (err) => toast({ title: err.message, variant: "danger" }),
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex flex-wrap items-end gap-6">
        <Select
          label="Watchlist"
          value={data.status ?? ""}
          onChange={(e) => handleWatchlistChange(e.target.value)}
          disabled={isPending}
          className="min-w-48"
        >
          <option value="">Not tracking</option>
          <option value="want_to_watch">Want to watch</option>
          <option value="watching">Watching</option>
          <option value="watched">Watched</option>
        </Select>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Your rating</span>
          <div className="flex items-center gap-2">
            <StarRating value={data.score ?? 0} onChange={handleRatingChange} />
            {data.score ? (
              <a
                href={`/api/share/rating?mediaType=${mediaType}&tmdbId=${tmdbId}&score=${data.score}`}
                download
                aria-label="Download poster with your rating"
                title="Download poster with your rating"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text-muted transition-colors hover:bg-surface-overlay hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Favourite</span>
          <button
            type="button"
            onClick={handleFavouriteToggle}
            disabled={toggleFavourite.isPending}
            aria-pressed={data.favourite}
            aria-label={data.favourite ? "Remove from favourites" : "Add to favourites"}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <span aria-hidden className={data.favourite ? "text-accent" : "text-text-muted"}>
              {data.favourite ? "♥" : "♡"}
            </span>
            {data.favourite ? "Favourited" : "Favourite"}
          </button>
        </div>
      </div>
    </div>
  );
}
