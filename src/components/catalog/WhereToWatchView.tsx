import { providersForRegion } from "@/lib/tmdb/providers";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProviderLogoRow } from "./ProviderLogoRow";

/**
 * Pure presentational component — no data fetching.
 * Rendered by WhereToWatchClient (which resolves the viewer's region client-side).
 */
export function WhereToWatchView({
  watch,
  region,
}: {
  watch: TmdbTitleDetail["watch/providers"] | undefined;
  region: string;
}) {
  const p = providersForRegion(watch, region);
  // Free + ad-supported services (Tubi, Pluto, etc.), deduped — a service can
  // appear in both groups.
  const seen = new Set<number>();
  const free = p
    ? [...p.free, ...p.ads].filter((s) => (seen.has(s.id) ? false : seen.add(s.id)))
    : [];
  const nothing =
    !p || (free.length === 0 && p.flatrate.length === 0 && p.rent.length === 0 && p.buy.length === 0);
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-text">Where to watch</h2>
      {nothing ? (
        <EmptyState
          title={`No streaming info for ${region}`}
          description="We couldn't find availability data for this title in your region."
        />
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
          <ProviderLogoRow label="Free" providers={free} />
          <ProviderLogoRow label="Stream" providers={p!.flatrate} />
          <ProviderLogoRow label="Rent" providers={p!.rent} />
          <ProviderLogoRow label="Buy" providers={p!.buy} />
          <p className="text-xs text-text-muted">
            Streaming data powered by JustWatch.
            {p!.link ? (
              <>
                {" "}
                <a href={p!.link} className="underline hover:text-text" target="_blank" rel="noopener noreferrer">
                  View on TMDB
                </a>
              </>
            ) : null}
          </p>
        </div>
      )}
    </section>
  );
}
