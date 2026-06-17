/** A labelled completion progress bar (server component, no interactivity). */
export function CompletionBar({ label, watched, total }: { label: string; watched: number; total: number }) {
  const pct = total > 0 ? Math.round((watched / total) * 100) : 0;
  const done = total > 0 && watched === total;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-medium text-text">{label}</span>
        <span className="shrink-0 text-text-muted">
          {watched}/{total}
          {done && " ✓"}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
        <div
          className={`h-full rounded-full transition-all ${done ? "bg-success" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
