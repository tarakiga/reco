"use client";
import { useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StarRating } from "@/components/ui/StarRating";
import { DatePicker } from "@/components/ui/DatePicker";
import { SeenDateModal } from "@/components/catalog/SeenDateModal";
import { useToast } from "@/components/ui/Toast";
import {
  useTitleState,
  useSetWatch,
  useRemoveWatch,
  useSetRating,
  useRemoveRating,
  useToggleFavourite,
  useDiaryDates,
  useLogDiary,
  useRemoveDiary,
} from "./useTitleState";

interface Props {
  mediaType: "movie" | "tv";
  tmdbId: number;
  /** When true the title isn't out yet — hide the rating control. */
  unreleased?: boolean;
  /** Release / first-air date ("YYYY-MM-DD"), used as the default "seen" date. */
  releaseDate?: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });

export function TitleActions({ mediaType, tmdbId, unreleased, releaseDate }: Props) {
  const { data, isLoading } = useTitleState(mediaType, tmdbId);
  const diary = useDiaryDates(mediaType, tmdbId);
  const setWatch = useSetWatch(mediaType, tmdbId);
  const removeWatch = useRemoveWatch(mediaType, tmdbId);
  const setRating = useSetRating(mediaType, tmdbId);
  const removeRating = useRemoveRating(mediaType, tmdbId);
  const logDiary = useLogDiary(mediaType, tmdbId);
  const removeDiary = useRemoveDiary(mediaType, tmdbId);
  const toggleFavourite = useToggleFavourite(mediaType, tmdbId);
  const toast = useToast();

  const [seenModalOpen, setSeenModalOpen] = useState(false);
  const [addingDate, setAddingDate] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-10 w-64" />;
  }

  if (!data?.signedIn) {
    return (
      <p className="rounded-md border border-border bg-surface-raised px-4 py-3 text-sm text-text-muted">
        <Link href="/sign-in" className="font-medium text-accent-text underline underline-offset-2 hover:text-accent-text/80">
          Sign in
        </Link>{" "}
        to add to your watchlist and rate this title.
      </p>
    );
  }

  const noun = mediaType === "tv" ? "show" : "movie";
  const dates = diary.data?.dates ?? [];
  // Lenient gate: a logged watch date OR an existing rating means "seen". So a
  // rating from before this flow still shows, and clearing diary dates never
  // silently deletes a rating.
  const seen = dates.length > 0 || data.score != null;
  const isPending = setWatch.isPending || removeWatch.isPending || setRating.isPending || removeRating.isPending;

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

  function handleRemoveRating() {
    removeRating.mutate(undefined, {
      onSuccess: () => toast({ title: "Rating removed", variant: "info" }),
      onError: (err) => toast({ title: err.message, variant: "danger" }),
    });
  }

  function handleFirstSeen(date: string) {
    logDiary.mutate(date, {
      onSuccess: () => {
        setSeenModalOpen(false);
        toast({ title: "Logged — now leave your rating ★", variant: "success" });
      },
      onError: (err) => toast({ title: err.message, variant: "danger" }),
    });
  }

  function handleAddDate(date: string) {
    if (!date) return;
    logDiary.mutate(date, {
      onSuccess: () => {
        setAddingDate(false);
        toast({ title: "Added to your diary", variant: "success" });
      },
      onError: (err) => toast({ title: err.message, variant: "danger" }),
    });
  }

  function handleRemoveDate(id: string) {
    removeDiary.mutate(id, {
      onSuccess: () => toast({ title: "Date removed", variant: "info" }),
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
          {/* "Watched" lives in the diary now; only shown here if already set, so
              existing watched items still display (not offered as a new choice). */}
          {data.status === "watched" && <option value="watched">Watched</option>}
        </Select>

        {!unreleased && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Your rating</span>
            {diary.isLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : seen ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <StarRating value={data.score ?? 0} onChange={handleRatingChange} />
                  {data.score ? (
                    <>
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
                      <button
                        type="button"
                        onClick={handleRemoveRating}
                        disabled={isPending}
                        aria-label="Remove your rating"
                        title="Remove your rating"
                        className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-overlay hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </>
                  ) : null}
                </div>
                {/* Watch log (rewatches), folded in from the old "I have seen this" card. */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {dates.map((d) => (
                    <span key={d.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px]">
                      <span className="text-text-muted">✓ {fmtDate(d.watchedOn)}</span>
                      <button type="button" onClick={() => handleRemoveDate(d.id)} aria-label="Remove date" className="leading-none text-text-muted hover:text-danger">
                        ×
                      </button>
                    </span>
                  ))}
                  {addingDate ? (
                    <DatePicker value="" onChange={(d) => d && handleAddDate(d)} max={today()} defaultOpen placeholder="Date watched" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingDate(true)}
                      className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] font-medium text-text-muted transition-colors hover:border-accent hover:text-text"
                    >
                      + add another date
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSeenModalOpen(true)}
                className="inline-flex h-9 items-center rounded-md border border-accent bg-accent/10 px-4 text-sm font-medium text-accent-text transition-colors hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Rate this {noun}
              </button>
            )}
          </div>
        )}

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
            <span aria-hidden className={data.favourite ? "text-accent-text" : "text-text-muted"}>
              {data.favourite ? "♥" : "♡"}
            </span>
            {data.favourite ? "Favourited" : "Favourite"}
          </button>
        </div>
      </div>

      {seenModalOpen && (
        <SeenDateModal releaseDate={releaseDate ?? null} onPick={handleFirstSeen} onClose={() => setSeenModalOpen(false)} />
      )}
    </div>
  );
}
