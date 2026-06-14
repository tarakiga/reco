"use client";
import { cn } from "@/lib/cn";

export function OnboardingPoster({
  title, year, posterUrl, selected, onClick,
}: {
  title: string; year: number | null; posterUrl: string | null; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative block w-full overflow-hidden rounded-lg border text-left transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        selected ? "border-accent ring-2 ring-accent/40" : "border-border hover:border-text-muted",
      )}
    >
      <div className="aspect-2/3 w-full bg-surface-overlay">
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      {selected && (
        <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-xs text-white">✓</span>
      )}
      <span className="block truncate px-1.5 py-1 text-xs text-text">{title}{year ? ` (${year})` : ""}</span>
    </button>
  );
}
