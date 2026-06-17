"use client";
import { useState } from "react";
import type { FilmographyCredit } from "@/lib/tmdb/person";
import { FilmographyModal } from "./FilmographyModal";

type Filter = "all" | "movie" | "tv" | "seen";

export function FilmographyGrid({
  personId,
  credits,
  watchedKeys,
}: {
  personId: number;
  credits: FilmographyCredit[];
  watchedKeys?: string[];
}) {
  const [selected, setSelected] = useState<FilmographyCredit | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const watched = new Set(watchedKeys ?? []);
  const isSeen = (c: FilmographyCredit) => watched.has(`${c.mediaType}:${c.tmdbId}`);

  const movies = credits.filter((c) => c.mediaType === "movie").length;
  const tv = credits.filter((c) => c.mediaType === "tv").length;
  const seen = credits.filter(isSeen).length;
  const shown =
    filter === "all" ? credits : filter === "seen" ? credits.filter(isSeen) : credits.filter((c) => c.mediaType === filter);
  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: `All ${credits.length}` },
    { key: "movie", label: `Movies ${movies}` },
    { key: "tv", label: `TV ${tv}` },
    ...(seen > 0 ? [{ key: "seen" as const, label: `Seen ${seen}` }] : []),
  ];

  return (
    <>
      {((movies > 0 && tv > 0) || seen > 0) && (
        <div className="mb-4 inline-flex rounded-lg border border-border bg-surface-raised p-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              aria-pressed={filter === t.key}
              className={
                filter === t.key
                  ? "rounded-md bg-accent px-3 py-1 font-medium text-text"
                  : "rounded-md px-3 py-1 text-text-muted transition-colors hover:text-text"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {shown.map((c) => (
          <button
            key={`${c.mediaType}-${c.tmdbId}`}
            type="button"
            onClick={() => setSelected(c)}
            className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div className="relative aspect-2/3 overflow-hidden rounded-md border border-border bg-surface-overlay">
              {c.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.posterUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl opacity-30" aria-hidden>
                  🎬
                </div>
              )}
              {isSeen(c) && (
                <span className="absolute left-1 top-1 rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-surface">
                  Seen
                </span>
              )}
            </div>
            <p className="mt-1.5 line-clamp-1 text-sm font-medium text-text">{c.title}</p>
            {c.character ? (
              <p className="line-clamp-1 text-xs text-text-muted">{c.character}</p>
            ) : c.year != null ? (
              <p className="text-xs text-text-muted">{c.year}</p>
            ) : null}
          </button>
        ))}
      </div>
      <FilmographyModal personId={personId} credit={selected} onClose={() => setSelected(null)} />
    </>
  );
}
