"use client";

import { useBrowserToday } from "@/components/ui/BrowserDate";
import { upcomingLabel } from "@/lib/release";

/** The "upcoming" pill from TitleCard, with the date decided in the browser so
 *  the card itself can be prerendered. Renders nothing until mounted. */
export function UpcomingBadge({ releaseDate }: { releaseDate: string | null }) {
  const today = useBrowserToday();
  if (today === null) return null;
  const label = upcomingLabel(releaseDate, new Date());
  if (!label) return null;
  return (
    <span className="rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm backdrop-blur-sm">
      {label}
    </span>
  );
}
