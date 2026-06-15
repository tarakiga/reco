import { personAwards } from "@/services/person-awards";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Awards sidebar block (Wikidata-sourced). Renders nothing if there's no data,
 *  so it's safe to drop into a Suspense boundary. */
export async function PersonAwards({ personId }: { personId: number }) {
  const a = await personAwards(personId);
  if (!a) return null;

  const rows: [string, string][] = [];
  if (a.oscars) rows.push(["Oscars", String(a.oscars)]);
  if (a.emmys) rows.push(["Emmys", String(a.emmys)]);
  if (a.goldenGlobes) rows.push(["Golden Globes", String(a.goldenGlobes)]);
  rows.push([
    "Total",
    a.nominations ? `${plural(a.wins, "win")} · ${plural(a.nominations, "nom")}` : plural(a.wins, "win"),
  ]);

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
        <span aria-hidden>🏆</span> Awards
      </h3>
      <dl className="space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 text-sm">
            <dt className="text-text-muted">{label}</dt>
            <dd className="font-medium tabular-nums text-text">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] text-text-muted">Award data from Wikidata</p>
    </div>
  );
}
