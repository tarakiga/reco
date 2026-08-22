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
 *  as a plain rail with no chip row. */
export function ChipRail({ title, groups }: { title: string; groups: ChipGroup[] }) {
  const [selected, setSelected] = useState(0);
  const active = groups[selected] ?? groups[0];
  if (!active) return null;

  const chips =
    groups.length > 1 ? (
      <div className="mb-3 flex flex-wrap gap-2">
        {groups.map((g, i) => (
          <button
            key={g.label}
            type="button"
            onClick={() => setSelected(i)}
            aria-pressed={i === selected}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              i === selected
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
    // Keyed by group so switching chips resets the scroll position.
    <Rail key={active.label} title={title} subheader={chips}>
      {active.items.map((r) => (
        <div key={`${r.mediaType}-${r.tmdbId}`} className="w-28 shrink-0">
          <TitleCard href={r.href} title={r.title} year={r.year} posterUrl={r.posterUrl} />
        </div>
      ))}
    </Rail>
  );
}
