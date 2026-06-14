import { TitleCard } from "@/components/catalog/TitleCard";
import { posterUrl } from "@/lib/tmdb/images";
import type { WatchlistEntry, WatchStatus } from "@/services/user-catalog";

const STATUS_GROUPS: { status: WatchStatus; label: string }[] = [
  { status: "watching", label: "Watching" },
  { status: "want_to_watch", label: "Want to watch" },
  { status: "watched", label: "Watched" },
];

/** Groups watchlist entries by status into labelled poster grids. */
export function WatchlistSections({ items }: { items: WatchlistEntry[] }) {
  const grouped = new Map<WatchStatus, WatchlistEntry[]>();
  for (const item of items) {
    const bucket = grouped.get(item.status) ?? [];
    bucket.push(item);
    grouped.set(item.status, bucket);
  }

  return (
    <div className="space-y-10">
      {STATUS_GROUPS.map(({ status, label }) => {
        const group = grouped.get(status);
        if (!group || group.length === 0) return null;
        return (
          <section key={status}>
            <h3 className="mb-4 text-lg font-semibold text-text">{label}</h3>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
              {group.map((item) => (
                <TitleCard
                  key={item.titleId}
                  href={`/title/${item.mediaType}/${item.tmdbId}-${item.slug}`}
                  title={item.title}
                  year={item.releaseYear}
                  posterUrl={posterUrl(item.posterPath)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
