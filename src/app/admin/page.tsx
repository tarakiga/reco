import { cacheLife } from "next/cache";
import { resolveBoxOfficeHero } from "@/services/box-office-hero";

// Near-live health probe, cached briefly so repeated admin loads don't re-scrape
// on every request but the status still reflects roughly the current state.
async function getHeroHealth() {
  "use cache";
  cacheLife("minutes");
  return resolveBoxOfficeHero();
}

export default async function AdminOverviewPage() {
  const health = await getHeroHealth();
  const reachable = health.boxOfficeTitle != null;
  const liveSource = health.source === "boxoffice" ? "Box Office Mojo" : "Popularity (fallback)";

  return (
    <div>
      <h1 className="text-2xl font-bold">Configuration</h1>
      <p className="mt-2 text-text-muted">
        Manage option lists and content blocks. Changes are drafts until you publish.
      </p>

      <section className="mt-8 max-w-md rounded-lg border border-border bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text">Box-office hero</h2>
        <p className="mt-1 text-xs text-text-muted">
          Live probe of the home hero source. If Box Office Mojo becomes
          unreachable, the hero quietly falls back to the most popular title.
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <HealthRow label="Box Office Mojo">
            <Dot ok={reachable} />
            {reachable ? "Reachable" : "Unreachable"}
          </HealthRow>
          <HealthRow label="Reported #1">
            <span className="text-text">{health.boxOfficeTitle ?? "—"}</span>
          </HealthRow>
          <HealthRow label="Matched in catalog">
            <Dot ok={health.matchedTmdb} />
            {health.matchedTmdb ? "Yes" : "No"}
          </HealthRow>
          <HealthRow label="Hero source">
            <Dot ok={health.source === "boxoffice"} />
            {liveSource}
          </HealthRow>
          <HealthRow label="Now showing">
            <span className="text-text">{health.title ?? "—"}</span>
          </HealthRow>
        </dl>
      </section>
    </div>
  );
}

function HealthRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="flex items-center gap-1.5 font-medium">{children}</dd>
    </div>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block size-2 rounded-full ${ok ? "bg-success" : "bg-warning"}`}
      aria-hidden
    />
  );
}
