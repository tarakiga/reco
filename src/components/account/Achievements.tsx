import type { Badge } from "@/lib/achievements";

/** Achievement badges (earned + locked-with-progress), shown on the Completion tab. */
export function Achievements({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <section className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text">Achievements</h3>
        <span className="text-xs text-text-muted">{earned}/{badges.length} unlocked</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {badges.map((b) => (
          <div
            key={b.id}
            title={b.desc}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
              b.earned ? "border-accent/40 bg-accent/10" : "border-border opacity-60"
            }`}
          >
            <span className={`text-xl ${b.earned ? "" : "grayscale"}`} aria-hidden>
              {b.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-text">{b.name}</p>
              <p className="truncate text-[11px] text-text-muted">
                {b.earned ? "Unlocked" : `${Math.min(b.value, b.threshold)}/${b.threshold}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
