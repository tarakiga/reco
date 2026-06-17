import { connection } from "next/server";
import Link from "next/link";
import { getCurrentProfile } from "@/services/profile";
import { getReleaseCalendar, getNewToStreaming, type ReleaseFilter } from "@/services/releases";
import { TitleCard } from "@/components/catalog/TitleCard";
import { Rail } from "@/components/catalog/Rail";
import { EmptyState } from "@/components/ui/EmptyState";
import { upcomingLabel } from "@/lib/release";
import { cardActionContext, favouriteProp, watchlistProp } from "@/services/favourites";

export const metadata = { title: "Release calendar" };

const FILTERS: { id: ReleaseFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "theaters", label: "In theaters" },
  { id: "streaming", label: "Streaming" },
];

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await connection();
  const { type } = await searchParams;
  const filter: ReleaseFilter = type === "theaters" || type === "streaming" ? type : "all";

  const profile = await getCurrentProfile();
  const region = profile?.region ?? "US";
  const today = todayYmd();

  const [days, newToStreaming, ctx] = await Promise.all([
    getReleaseCalendar(region, filter, today),
    getNewToStreaming(region, today),
    cardActionContext(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text">Release calendar</h1>
        <p className="text-sm text-text-muted">
          What&apos;s coming out in {region} over the next two months.
        </p>
      </header>

      {newToStreaming.length > 0 && (
        <Rail title="New to streaming">
          {newToStreaming.map((t) => (
            <div key={t.tmdbId} className="w-32 shrink-0">
              <TitleCard
                href={t.href}
                title={t.title}
                year={t.year}
                posterUrl={t.posterUrl}
                favourite={favouriteProp(ctx, "movie", t.tmdbId)}
                watchlist={watchlistProp(ctx, "movie", t.tmdbId)}
              />
            </div>
          ))}
        </Rail>
      )}

      {/* Theatrical / streaming filter */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <Link
              key={f.id}
              href={f.id === "all" ? "/calendar" : `/calendar?type=${f.id}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-accent bg-accent/15 text-text"
                  : "border-border bg-surface text-text-muted hover:bg-surface-overlay hover:text-text"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {days.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          description="No upcoming releases match this filter for your region right now."
        />
      ) : (
        <div className="space-y-8">
          {days.map((day) => (
            <section key={day.date}>
              <h2 className="mb-3 border-b border-border pb-1 text-sm font-semibold uppercase tracking-wide text-text-muted">
                {day.label}
              </h2>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
                {day.items.map((t) => (
                  <TitleCard
                    key={t.tmdbId}
                    href={t.href}
                    title={t.title}
                    year={t.year}
                    posterUrl={t.posterUrl}
                    upcoming={upcomingLabel(t.releaseDate)}
                    favourite={favouriteProp(ctx, "movie", t.tmdbId)}
                    watchlist={watchlistProp(ctx, "movie", t.tmdbId)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
