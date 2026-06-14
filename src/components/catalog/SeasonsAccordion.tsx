"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SeasonSummary, EpisodeVM } from "@/lib/tmdb/episodes";

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function fmtRuntime(min: number | null): string | null {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

function EpisodeRow({ ep }: { ep: EpisodeVM }) {
  const meta = [fmtDate(ep.airDate), fmtRuntime(ep.runtime)].filter(Boolean).join(" · ");
  return (
    <li className="flex gap-3">
      <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-md border border-border bg-surface-overlay">
        {ep.stillUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ep.stillUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="truncate text-sm font-medium text-text">
            {ep.episodeNumber}. {ep.name}
          </h4>
          {ep.voteAverage ? (
            <span className="shrink-0 text-xs font-medium text-warning">★ {ep.voteAverage.toFixed(1)}</span>
          ) : null}
        </div>
        {meta && <p className="mt-0.5 text-xs text-text-muted">{meta}</p>}
        {ep.overview && <p className="mt-1 line-clamp-2 text-sm text-text-muted">{ep.overview}</p>}
      </div>
    </li>
  );
}

function SeasonItem({
  tvId,
  season,
  defaultOpen,
}: {
  tvId: number;
  season: SeasonSummary;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tv-season", tvId, season.seasonNumber],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tv/${tvId}/season/${season.seasonNumber}`);
      if (!res.ok) throw new Error("Failed to load season");
      return res.json() as Promise<{ episodes: EpisodeVM[] }>;
    },
    enabled: open,
    staleTime: 60 * 60 * 1000,
  });
  const episodes = data?.episodes ?? [];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:text-accent"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`size-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="font-semibold text-text">{season.name}</span>
        <span className="text-sm text-text-muted">
          {season.episodeCount} {season.episodeCount === 1 ? "episode" : "episodes"}
          {season.year ? ` · ${season.year}` : ""}
        </span>
      </button>
      {open && (
        <div className="pb-4">
          {isLoading ? (
            <ul className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex gap-3">
                  <div className="aspect-video w-28 shrink-0 animate-pulse rounded-md bg-surface-overlay" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-surface-overlay" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-surface-overlay" />
                  </div>
                </li>
              ))}
            </ul>
          ) : isError ? (
            <p className="text-sm text-text-muted">Couldn&apos;t load this season. Try again later.</p>
          ) : episodes.length === 0 ? (
            <p className="text-sm text-text-muted">No episode details available.</p>
          ) : (
            <ul className="space-y-3">
              {episodes.map((ep) => (
                <EpisodeRow key={ep.episodeNumber} ep={ep} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function SeasonsAccordion({ tvId, seasons }: { tvId: number; seasons: SeasonSummary[] }) {
  if (seasons.length === 0) return null;
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-surface-raised px-4">
      {seasons.map((s, i) => (
        <SeasonItem key={s.seasonNumber} tvId={tvId} season={s} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
