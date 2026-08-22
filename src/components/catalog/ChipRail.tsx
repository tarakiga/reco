"use client";
import { useState } from "react";
import { Rail } from "./Rail";
import { TitleCard } from "./TitleCard";
import type { TitleResult } from "@/lib/tmdb/transform";

export interface ChipGroup {
  label: string;
  items: TitleResult[];
}

/** Chip-switched title rail. Every group arrives server-fetched, so switching
 *  chips swaps the cards instantly with zero requests. A single group renders
 *  as a plain rail with no chip row, unless showSoloChip keeps its label visible. */
export function ChipRail({
  title,
  groups,
  showSoloChip,
}: {
  title: string;
  groups: ChipGroup[];
  /** Show the chip row even with a single group, so its label is not lost. */
  showSoloChip?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  // Guards against a stale index from a previous title's group count.
  const idx = selected < groups.length ? selected : 0;
  const active = groups[idx];
  if (!active) return null;

  const chips =
    groups.length > 1 || (showSoloChip && groups.length === 1) ? (
      <div className="mb-3 flex flex-wrap gap-2">
        {groups.map((g, i) => (
          <button
            key={`${i}-${g.label}`}
            type="button"
            onClick={() => setSelected(i)}
            aria-pressed={i === idx}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              i === idx
                ? "border-accent bg-accent/15 text-accent-text"
                : "border-border bg-surface-raised text-text-muted hover:bg-surface-overlay hover:text-text"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    // scrollResetKey resets scroll position on chip change without remounting
    // the rail, so focus (e.g. keyboard focus on a chip) is preserved.
    <Rail title={title} subheader={chips} scrollResetKey={selected}>
      {active.items.map((r) => (
        <div key={`${r.mediaType}-${r.tmdbId}`} className="w-28 shrink-0">
          <TitleCard href={r.href} title={r.title} year={r.year} posterUrl={r.posterUrl} />
        </div>
      ))}
    </Rail>
  );
}
