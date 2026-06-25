"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TrailerEmbed } from "@/components/catalog/TrailerEmbed";

export interface ListCardItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  genres: string[];
  overview: string | null;
  trailerKey: string | null;
  href: string;
  rating: number | null;
  runtime: number | null;
  seasons: number | null;
  note: string | null;
  /** Set when the pick is a specific episode (else null = whole movie/show). */
  season: number | null;
  episode: number | null;
  episodeName: string | null;
}

function fmtRuntime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

/** Rich list-item card: poster, genre, year, synopsis, trailer (lightbox) and a
 *  link to the detail page. */
export function ListCard({ item, index, showRank = true }: { item: ListCardItem; index: number; showRank?: boolean }) {
  const [trailer, setTrailer] = useState(false);

  const isEpisode = item.episode != null;
  const facts = [
    item.runtime ? fmtRuntime(item.runtime) : null,
    // A season count is misleading on a single-episode pick, so omit it then.
    !isEpisode && item.seasons ? `${item.seasons} season${item.seasons === 1 ? "" : "s"}` : null,
    ...item.genres,
  ].filter(Boolean).join(" · ");

  useEffect(() => {
    if (!trailer) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTrailer(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [trailer]);

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3 sm:p-4">
      <div className="flex gap-4">
      <Link href={item.href} className="w-24 shrink-0 sm:w-28">
        <div className="aspect-2/3 overflow-hidden rounded-md border border-border bg-surface-overlay">
          {item.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {showRank && <span className="text-sm font-semibold text-text-muted">{index + 1}.</span>}
          <Link href={item.href} className="text-base font-semibold text-text transition-colors hover:text-accent">
            {item.title}
          </Link>
          {item.year && <span className="text-sm text-text-muted">{item.year}</span>}
        </div>
        {isEpisode && (
          <p className="mt-0.5 text-sm font-medium text-accent">
            Season {item.season} · Episode {item.episode}
            {item.episodeName ? ` · ${item.episodeName}` : ""}
          </p>
        )}
        {(item.rating || facts) && (
          <p className="mt-0.5 text-xs text-text-muted">
            {item.rating != null && (
              <span className="font-medium text-warning">★ {item.rating.toFixed(1)}</span>
            )}
            {item.rating != null && facts ? " · " : ""}
            {facts}
          </p>
        )}
        {item.overview && <p className="mt-2 line-clamp-3 text-sm text-text-muted">{item.overview}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {item.trailerKey && (
            <button
              type="button"
              onClick={() => setTrailer(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Trailer
            </button>
          )}
          <Link
            href={item.href}
            className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text transition-colors hover:bg-surface-overlay"
          >
            View details
          </Link>
        </div>
      </div>
      </div>

      {/* Curator's note — the reason this pick is on the list */}
      {item.note && (
        <div className="mt-3 flex gap-2 rounded-md bg-accent/5 px-3 py-2.5">
          <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <p className="text-sm italic leading-relaxed text-text">{item.note}</p>
        </div>
      )}

      {trailer && item.trailerKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button type="button" aria-label="Close trailer" className="absolute inset-0 cursor-default" onClick={() => setTrailer(false)} />
          <div className="relative z-10 w-full max-w-3xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-white">{item.title} — Trailer</p>
              <button
                type="button"
                onClick={() => setTrailer(false)}
                aria-label="Close"
                className="rounded-md px-2 py-1 text-sm text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
            <TrailerEmbed youtubeKey={item.trailerKey} />
          </div>
        </div>
      )}
    </div>
  );
}
