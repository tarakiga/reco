import { connection } from "next/server";
import { requireRole } from "@/services/authz";
import { getAnalytics } from "@/services/analytics";
import { StatCard, Panel, BarChart, TitleStatList } from "@/components/admin/AnalyticsWidgets";

export const metadata = { title: "Analytics" };

export default async function AdminAnalyticsPage() {
  await connection();
  await requireRole("editor");
  const a = await getAnalytics();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Analytics</h1>
      <p className="mb-6 text-sm text-text-muted">Aggregate activity across all users. Updates live on each load.</p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard label="Users" value={a.users.total} sub={`${a.users.rated} rated · ${a.users.onboarded} onboarded`} />
        <StatCard label="Ratings" value={a.totals.ratings} />
        <StatCard label="Watchlist" value={a.totals.watchlist} />
        <StatCard label="Favourites" value={a.totals.favourites} />
        <StatCard label="Catalog" value={a.catalog.titles.toLocaleString()} sub={`titles · ${a.catalog.people.toLocaleString()} people`} />
        <StatCard label="Embedded" value={`${a.catalog.coveragePct}%`} sub={`${a.catalog.embeddings.toLocaleString()} vectors`} />
        <StatCard label="DB storage" value={`~${a.catalog.estStorageGb} GB`} sub="est. metadata + vectors" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="New users (weekly)"><BarChart items={a.signups} /></Panel>
        <Panel title="Activity — ratings + watchlist (weekly)"><BarChart items={a.activity} /></Panel>
        <Panel title="Rating distribution"><BarChart items={a.ratingDist} accent="bg-warning" /></Panel>
        <Panel title="Watchlist status"><BarChart items={a.watchlistStatus} /></Panel>
        <Panel title="Top genres (in liked titles)"><BarChart items={a.topGenres} /></Panel>
        <Panel title="Highest rated (≥2 ratings)"><TitleStatList items={a.topRated} /></Panel>
        <Panel title="Most rated"><TitleStatList items={a.mostRated} /></Panel>
      </div>
    </div>
  );
}
