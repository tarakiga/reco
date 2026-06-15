import Link from "next/link";
import type { Bucket, TitleStat } from "@/services/analytics";

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-text">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface-raised p-4">
      <h2 className="mb-3 text-sm font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

/** Horizontal bar list (CSS bars — no chart library needed). */
export function BarChart({ items, accent = "bg-accent" }: { items: Bucket[]; accent?: string }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">No data yet.</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={`${it.label}-${i}`} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 truncate text-text-muted" title={it.label}>{it.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-surface-overlay">
            <div className={`h-full rounded ${accent}`} style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right font-medium tabular-nums text-text">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TitleStatList({ items }: { items: TitleStat[] }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">No data yet.</p>;
  return (
    <ol className="space-y-1.5">
      {items.map((it, i) => (
        <li key={it.href} className="flex items-baseline gap-2 text-sm">
          <span className="w-4 shrink-0 text-right text-text-muted tabular-nums">{i + 1}</span>
          <Link href={it.href} className="min-w-0 flex-1 truncate text-text hover:underline">{it.title}</Link>
          <span className="shrink-0 text-xs text-text-muted">{it.sub ?? it.value}</span>
        </li>
      ))}
    </ol>
  );
}
