import { personAwards } from "@/services/person-awards";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const MAX_ROWS = 8;

/** Awards sidebar block (Wikidata-sourced), grouped by awarding body so you can
 *  see where every win came from. Renders nothing without data — Suspense-safe. */
export async function PersonAwards({ personId }: { personId: number }) {
  const a = await personAwards(personId);
  if (!a) return null;

  const groups = a.groups ?? []; // tolerate a stale-cache entry from before grouping existed
  const shown = groups.slice(0, MAX_ROWS);
  const moreBodies = groups.length - shown.length;
  const moreWins = groups.slice(MAX_ROWS).reduce((s, g) => s + g.count, 0);

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
        <span aria-hidden>🏆</span> Awards
      </h3>
      <dl className="space-y-1.5">
        {shown.map((g) => (
          <div key={g.body} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="min-w-0 truncate text-text-muted" title={g.body}>{g.body}</dt>
            <dd className="shrink-0 font-medium tabular-nums text-text">{g.count}</dd>
          </div>
        ))}
        {moreBodies > 0 && (
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-text-muted">{moreBodies} other bod{moreBodies === 1 ? "y" : "ies"}</dt>
            <dd className="shrink-0 font-medium tabular-nums text-text">{moreWins}</dd>
          </div>
        )}
      </dl>
      <p className="mt-2 border-t border-border pt-2 text-xs text-text-muted">
        {plural(a.wins, "win")}
        {a.nominations > 0 ? ` · ${plural(a.nominations, "nomination")}` : ""} · via Wikidata
      </p>
    </div>
  );
}
