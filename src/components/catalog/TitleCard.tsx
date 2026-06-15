import Link from "next/link";
import { CardFavouriteButton } from "./CardFavouriteButton";
import type { CardFavourite } from "@/lib/favourite";

export function TitleCard({
  href,
  title,
  year,
  posterUrl,
  upcoming,
  favourite,
}: {
  href: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  /** Pre-computed "upcoming" date label (e.g. "Aug 15, 2026"); computed by the
   *  page since it depends on the current time (not allowed in prerendered cards). */
  upcoming?: string | null;
  /** When provided, shows a heart to favourite the title without opening it. */
  favourite?: CardFavourite;
}) {
  return (
    <Link href={href} className="group block w-full">
      <div className="relative aspect-2/3 overflow-hidden rounded-md border border-border bg-surface-overlay">
        {favourite && <CardFavouriteButton {...favourite} />}
        {upcoming && (
          <span className="absolute left-1 top-1 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm backdrop-blur-sm">
            {upcoming}
          </span>
        )}
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
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
      <p className="mt-1.5 line-clamp-1 text-sm font-medium text-text">{title}</p>
      {year !== null && <p className="text-xs text-text-muted">{year}</p>}
    </Link>
  );
}
