import Link from "next/link";
import type { EpgEntry } from "@/services/epg";
import { CalendarSubscribe } from "./CalendarSubscribe";

const DAY = 86_400_000;
const fmt = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" });

interface Bucket {
  label: string;
  entries: (EpgEntry & { rel: string; today: boolean })[];
}

function group(entries: EpgEntry[]): Bucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const order = ["Today", "Tomorrow", "This week", "This month", "Later"];
  const map = new Map<string, Bucket["entries"]>();

  for (const e of entries) {
    const d = new Date(`${e.airDate}T00:00:00`);
    const diff = Math.round((d.getTime() - today.getTime()) / DAY);
    const label =
      diff <= 0 ? "Today" : diff === 1 ? "Tomorrow" : diff <= 7 ? "This week" : diff <= 31 ? "This month" : "Later";
    const rel = diff <= 0 ? "Today" : diff === 1 ? "Tomorrow" : `in ${diff} days`;
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push({ ...e, rel, today: diff <= 0 });
  }
  return order.filter((l) => map.has(l)).map((label) => ({ label, entries: map.get(label)! }));
}

export function UpcomingEpg({
  entries,
  icsUrl,
  webcalUrl,
  googleUrl,
}: {
  entries: EpgEntry[];
  icsUrl: string;
  webcalUrl: string;
  googleUrl: string;
}) {
  const buckets = group(entries);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-text">Coming up</h2>
        {entries.length > 0 && (
          <CalendarSubscribe icsUrl={icsUrl} webcalUrl={webcalUrl} googleUrl={googleUrl} />
        )}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-raised p-4 text-sm text-text-muted">
          Add TV shows to your watchlist and the next episode of each will show up here — plus you
          can subscribe to it as a calendar.
        </p>
      ) : (
        <div className="space-y-6">
          {buckets.map((b) => (
            <section key={b.label}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {b.label}
              </h3>
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised">
                {b.entries.map((e) => (
                  <li key={`${e.tvId}-${e.seasonNumber}-${e.episodeNumber}`}>
                    <Link
                      href={e.href}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-overlay"
                    >
                      <div className="aspect-2/3 w-10 shrink-0 overflow-hidden rounded border border-border bg-surface-overlay">
                        {e.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{e.showTitle}</p>
                        <p className="truncate text-xs text-text-muted">
                          S{String(e.seasonNumber).padStart(2, "0")}E{String(e.episodeNumber).padStart(2, "0")}
                          {e.episodeName ? ` · ${e.episodeName}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-text">{fmt.format(new Date(`${e.airDate}T00:00:00`))}</p>
                        <p className={`text-[11px] ${e.today ? "font-semibold text-accent" : "text-text-muted"}`}>
                          {e.rel}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
