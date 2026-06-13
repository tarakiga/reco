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

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex flex-wrap items-end gap-6">
        <Select
          label="Watchlist"
          value={data.status ?? ""}
          onChange={(e) => handleWatchlistChange(e.target.value)}
          disabled={isPending}
          className="min-w-[180px]"
        >
          <option value="">Not tracking</option>
          <option value="want_to_watch">Want to watch</option>
          <option value="watching">Watching</option>
          <option value="watched">Watched</option>
        </Select>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Your rating</span>
          <StarRating
            value={data.score ?? 0}
            onChange={handleRatingChange}
          />
        </div>
      </div>
    </div>
  );
}
