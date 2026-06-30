import Link from "next/link";
import { CardFavouriteButton } from "./CardFavouriteButton";
import { CardWatchlistButton } from "./CardWatchlistButton";
import type { CardFavourite, CardWatchlist } from "@/lib/favourite";
import type { StatusBadge } from "@/lib/tv-status";

export function TitleCard({
  href,
  title,
  year,
  posterUrl,
  upcoming,
  estimated,
  status,
  favourite,
  watchlist,
}: {
  href: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  /** Pre-computed "upcoming" date label (e.g. "Aug 15, 2026"); computed by the
   *  page since it depends on the current time (not allowed in prerendered cards). */
  upcoming?: string | null;
  /** Release calendar: marks the date as an estimated VOD window (adds an "Est."
   *  badge) so a projected streaming date never reads as confirmed. */
  estimated?: boolean;
  /** TV production status badge (Ended / Cancelled) — only for terminal states. */
  status?: StatusBadge | null;
  /** When provided, shows a heart to favourite the title without opening it. */
  favourite?: CardFavourite;
  /** When provided, shows a bookmark to add to the watchlist without opening it. */
  watchlist?: CardWatchlist;
}) {
  return (
    <Link href={href} className="group block w-full">
      <div className="relative aspect-2/3 overflow-hidden rounded-lg border border-border bg-surface-overlay transition duration-200 group-hover:border-accent/50 group-hover:ring-2 group-hover:ring-accent/40">
        {(watchlist || favourite) && (
          <div className="absolute right-1.5 top-1.5 z-10 flex flex-col gap-1.5">
            {watchlist && <CardWatchlistButton {...watchlist} />}
            {favourite && <CardFavouriteButton {...favourite} />}
          </div>
        )}
        {(status || upcoming || estimated) && (
          <div className="absolute left-1 top-1 z-10 flex flex-col items-start gap-1">
            {status && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm backdrop-blur-sm ${
                  status.tone === "danger" ? "bg-danger/90" : "bg-black/75"
                }`}
              >
                {status.label}
              </span>
            )}
            {upcoming && (
              <span className="rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm backdrop-blur-sm">
                {upcoming}
              </span>
            )}
            {estimated && (
              <span
                title="Estimated VOD date — not yet confirmed"
                className="rounded bg-warning/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-black shadow-sm backdrop-blur-sm"
              >
                Est. VOD
              </span>
            )}
          </div>
        )}
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105 group-hover:brightness-110"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-text-muted"
            aria-label={title}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-8 opacity-30"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="20" height="20" rx="2" />
              <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5" />
            </svg>
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-1 text-sm font-medium text-text transition-colors group-hover:text-accent-text">{title}</p>
      {year !== null && <p className="text-xs text-text-muted">{year}</p>}
    </Link>
  );
}
