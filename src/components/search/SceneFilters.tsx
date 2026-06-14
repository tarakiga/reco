import Link from "next/link";

const OPTIONS = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies" },
  { key: "tv", label: "TV" },
] as const;

/** Segmented Movies / TV / All control for the /find results. Plain links so it
 *  works without client JS; the active item reflects the applied media filter. */
export function SceneFilters({ query, active }: { query: string; active: "movie" | "tv" | null }) {
  const activeKey = active ?? "all";
  return (
    <div className="mt-4 inline-flex rounded-lg border border-border bg-surface-raised p-1 text-sm">
      {OPTIONS.map((o) => {
        const isActive = o.key === activeKey;
        return (
          <Link
            key={o.key}
            href={`/find?q=${encodeURIComponent(query)}&type=${o.key}`}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-md bg-accent px-3 py-1.5 font-medium text-text"
                : "rounded-md px-3 py-1.5 text-text-muted transition-colors hover:text-text"
            }
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
