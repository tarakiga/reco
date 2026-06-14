"use client";
import Link from "next/link";
import { useMatches } from "@/components/catalog/useMatch";
import { MatchBadge } from "@/components/catalog/MatchBadge";
import { useSetWatch } from "@/components/catalog/useTitleState";
import type { ShufflePick } from "@/services/shuffle";

function Card({ pick, match }: { pick: ShufflePick; match: number | undefined }) {
  const setWatch = useSetWatch(pick.mediaType, pick.tmdbId);
  return (
    <div className="relative">
      {match != null && <div className="absolute left-1.5 top-1.5 z-10"><MatchBadge match={match} /></div>}
      <Link href={pick.href} className="block overflow-hidden rounded-lg border border-border bg-surface-overlay">
        <div className="aspect-2/3 w-full">
          {pick.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pick.posterUrl} alt={pick.title} className="h-full w-full object-cover" loading="lazy" />
          )}
        </div>
      </Link>
      <div className="mt-1.5 truncate text-xs text-text">{pick.title}{pick.year ? ` (${pick.year})` : ""}</div>
      <div className="mt-1 flex items-center gap-1">
        {pick.providers.slice(0, 3).map((p) => p.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.logoUrl} alt={p.name} title={p.name} className="size-4 rounded" />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setWatch.mutate("want_to_watch")}
        disabled={setWatch.isPending || setWatch.isSuccess}
        className="mt-1.5 w-full rounded-md border border-border bg-surface-raised py-1 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text disabled:opacity-60"
      >
        {setWatch.isSuccess ? "✓ On watchlist" : "+ Watchlist"}
      </button>
    </div>
  );
}

export function ShuffleResults({ picks }: { picks: ShufflePick[] }) {
  const { data: matchesRaw } = useMatches(picks.map((p) => p.titleId));
  const matches = matchesRaw as Record<string, number> | undefined;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {picks.map((pick) => (
        <Card key={pick.titleId} pick={pick} match={matches?.[pick.titleId]} />
      ))}
    </div>
  );
}
