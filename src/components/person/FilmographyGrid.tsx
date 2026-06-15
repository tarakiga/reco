"use client";
import { useState } from "react";
import type { FilmographyCredit } from "@/lib/tmdb/person";
import { FilmographyModal } from "./FilmographyModal";

export function FilmographyGrid({ personId, credits }: { personId: number; credits: FilmographyCredit[] }) {
  const [selected, setSelected] = useState<FilmographyCredit | null>(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {credits.map((c) => (
          <button
            key={`${c.mediaType}-${c.tmdbId}`}
            type="button"
            onClick={() => setSelected(c)}
            className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div className="aspect-2/3 overflow-hidden rounded-md border border-border bg-surface-overlay">
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
