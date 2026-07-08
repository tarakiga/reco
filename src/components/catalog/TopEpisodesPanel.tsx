"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import type { TopEpisode } from "@/lib/tmdb/episodes";

function year(airDate: string | null): string {
  return airDate && airDate.length >= 4 ? airDate.slice(0, 4) : "";
}

function Row({ ep, rank }: { ep: TopEpisode; rank: number }) {
  return (
    <li>
      <a
        href={`#s${ep.seasonNumber}e${ep.episodeNumber}`}
        className="flex gap-3 rounded-md p-2 transition-colors hover:bg-surface-overlay"
      >
        <span className="w-5 shrink-0 self-center text-center text-sm font-bold text-text-muted">{rank}</span>
        <div className="aspect-video w-24 shrink-0 self-start overflow-hidden rounded-md border border-border bg-surface-overlay">
          {ep.stillUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ep.stillUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="truncate text-sm font-medium text-text">
              S{ep.seasonNumber} E{ep.episodeNumber} · {ep.name}
            </h4>
            {ep.voteAverage != null && (
              <span className="shrink-0 text-xs font-medium text-warning">
                ★ {ep.voteAverage.toFixed(1)}
                {ep.voteCount != null && <span className="ml-1 text-text-muted">({ep.voteCount.toLocaleString()})</span>}
              </span>
            )}
          </div>
          {year(ep.airDate) && <p className="text-xs text-text-muted">{year(ep.airDate)}</p>}
          {ep.overview && <p className="mt-1 line-clamp-2 text-sm text-text-muted">{ep.overview}</p>}
        </div>
      </a>
    </li>
  );
}

/**
 * Collapsible "best of" panel. Lazy-loads the whole show's episode ratings on
 * first open (so a page view / crawler doesn't fetch every season), ranks them,
 * and links each row into the seasons accordion below via a #sXeY anchor.
 */
export function TopEpisodesPanel({ tvId }: { tvId: number }) {
  const [open, setOpen] = useState(false);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["top-episodes", tvId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tv/${tvId}/top-episodes`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ episodes: TopEpisode[] }>;
    },
    enabled: open,
    staleTime: 60 * 60 * 1000,
  });
  const eps = data?.episodes ?? [];

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-border bg-surface-raised">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-overlay"
      >
        <span className="text-warning" aria-hidden>★</span>
        <span className="font-semibold text-text">Top rated episodes</span>
        <span className="hidden text-sm text-text-muted sm:inline">Ranked by viewer rating</span>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden className={cn("ml-auto size-4 shrink-0 text-text-muted transition-transform", open && "rotate-90")}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border px-2 py-2">
          {isFetching ? (
            <p className="px-2 py-2 text-sm text-text-muted">Ranking every episode…</p>
          ) : isError ? (
            <p className="px-2 py-2 text-sm text-text-muted">Couldn&apos;t rank episodes. Try again later.</p>
          ) : eps.length === 0 ? (
            <p className="px-2 py-2 text-sm text-text-muted">Not enough episode ratings yet to rank this show.</p>
          ) : (
            <ol className="space-y-1">
              {eps.map((ep, i) => (
                <Row key={`${ep.seasonNumber}-${ep.episodeNumber}`} ep={ep} rank={i + 1} />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
