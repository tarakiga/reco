"use client";
import { useState } from "react";
import { Rail } from "./Rail";
import { TitleCard } from "./TitleCard";
import type { TitleResult } from "@/lib/tmdb/transform";

export interface ChipGroup {
  label: string;
  items: TitleResult[];
}

/** Label for the curated-recommendations chip, shared with AlsoLikeSection so
 *  the two never drift out of sync when compared. */
export const TOP_PICKS_LABEL = "Top picks";

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

  const selectedChipClass = "border-accent bg-accent/15 text-accent-text";
  const unselectedChipClass =
    "border-border bg-surface-raised text-text-muted hover:bg-surface-overlay hover:text-text";

  const chips =
    groups.length > 1 ? (
      <div className="mb-3 flex flex-wrap gap-2">
        {groups.map((g, i) => (
          <button
            key={`${i}-${g.label}`}
            type="button"
            onClick={() => setSelected(i)}
            aria-pressed={i === idx}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              i === idx ? selectedChipClass : unselectedChipClass
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
    ) : showSoloChip && groups.length === 1 ? (
      // A single group with no other chip to switch to, so it's a label, not
      // a control: no onClick, no aria-pressed.
      <div className="mb-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${selectedChipClass}`}>
          {groups[0].label}
        </span>
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
