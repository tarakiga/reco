import { getWatchedEpisodes } from "@/services/episode-watches";
import { nextUnwatched, watchKey } from "@/lib/watch-progress";
import type { SeasonSummary } from "@/lib/tmdb/episodes";

/**
 * "14 of 62 episodes · Next up: S2 E3" above the season list. Signed-in only,
 * and renders nothing until at least one episode is marked watched, so the
 * common case costs nothing and shows nothing. One indexed DB read; the season
 * episode counts come from metadata already on the page. The total includes a
 * currently airing season's unaired remainder, accepted in the spec: fixing it
 * needs a fetch this feature refuses to add.
 */
export async function WatchProgress({
  userId,
  tvId,
  seasons,
}: {
  userId: string | null;
  tvId: number;
  seasons: SeasonSummary[];
}) {
  if (!userId || seasons.length === 0) return null;

  const rows = await getWatchedEpisodes(userId, tvId);
  if (rows.length === 0) return null;

  const real = seasons.filter((s) => s.seasonNumber > 0);
  const total = real.reduce((n, s) => n + s.episodeCount, 0);
  if (total === 0) return null;

  const watched = new Set(rows.map((r) => watchKey(r.season, r.episode)));
  // Count only watches that map onto listed real seasons, so a stale mark on a
  // since-removed episode cannot push the bar past 100 percent.
  const counted = rows.filter((r) => {
    const s = real.find((x) => x.seasonNumber === r.season);
    return s != null && r.episode >= 1 && r.episode <= s.episodeCount;
  }).length;
  const next = nextUnwatched(watched, real);
  const pct = Math.min(100, Math.round((counted / total) * 100));

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
