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
}

/** Rich list-item card: poster, genre, year, synopsis, trailer (lightbox) and a
 *  link to the detail page. */
export function ListCard({ item, index }: { item: ListCardItem; index: number }) {
  const [trailer, setTrailer] = useState(false);

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
    <div className="flex gap-4 rounded-lg border border-border bg-surface-raised p-3 sm:p-4">
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
          <span className="text-sm font-semibold text-text-muted">{index + 1}.</span>
          <Link href={item.href} className="text-base font-semibold text-text transition-colors hover:text-accent">
            {item.title}
          </Link>
          {item.year && <span className="text-sm text-text-muted">{item.year}</span>}
        </div>
        {item.genres.length > 0 && (
          <p className="mt-0.5 text-xs text-text-muted">{item.genres.join(" · ")}</p>
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
