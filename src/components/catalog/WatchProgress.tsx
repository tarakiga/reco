"use client";
import { watchProgressSummary } from "@/lib/watch-progress";
import type { SeasonSummary } from "@/lib/tmdb/episodes";
import { useEpisodeWatches } from "./useEpisodeWatches";

/**
 * "14 of 62 episodes · Next up: S2 E3" above the season list. Signed-in only,
 * and renders nothing until at least one episode is marked watched, so the
 * common case shows nothing. Reads the same browser query as the season list,
 * so the page itself stays the same for every visitor and ticks in the list
 * move the bar straight away.
 */
export function WatchProgress({ tvId, seasons }: { tvId: number; seasons: SeasonSummary[] }) {
  const { data } = useEpisodeWatches(tvId);
  const summary = data ? watchProgressSummary(data.episodes, seasons) : null;
  if (!summary) return null;
  const { counted, total, pct, next } = summary;

  return (
    <div className="mb-4 rounded-md border border-border bg-surface-raised px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-text">
          {counted} of {total} episodes
        </span>
        {next ? (
          /* Plain anchor on purpose: next/link's pushState never fires the hashchange the accordion listens for. */
          <a href={`#s${next.season}e${next.episode}`} className="font-medium text-accent-text hover:underline">
            Next up: S{next.season} E{next.episode}
          </a>
        ) : (
          <span className="font-medium text-success">All caught up</span>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-overlay">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
