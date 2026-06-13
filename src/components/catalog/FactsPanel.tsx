import type { Fact } from "@/lib/tmdb/detail";

export function FactsPanel({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null;
  return (
    <aside className="rounded-lg border border-border bg-surface-raised p-4">
      <h2 className="mb-3 text-sm font-semibold text-text">Facts</h2>
      <dl className="space-y-3">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-xs text-text-muted">{f.label}</dt>
            <dd className={f.tone === "money" ? "text-sm font-medium text-success" : "text-sm text-text"}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
