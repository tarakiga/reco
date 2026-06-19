"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { GUIDE_COUNTRIES, DEFAULT_GUIDE_COUNTRY } from "@/lib/guide/countries";
import type { GuideChannel } from "@/services/guide";

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function nextDays(n: number): Date[] {
  const out: Date[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}

function dayLabel(d: Date, i: number): string {
  if (i === 0) return "Today";
  if (i === 1) return "Tomorrow";
  return d.toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" });
}

function isOnNow(airstamp: string | null, runtime: number | null): boolean {
  if (!airstamp) return false;
  const start = Date.parse(airstamp);
  if (Number.isNaN(start)) return false;
  const end = start + (runtime && runtime > 0 ? runtime : 30) * 60_000;
  const now = Date.now();
  return now >= start && now < end;
}

export function GuideClient() {
  const days = useMemo(() => nextDays(7), []);
  const [country, setCountry] = useState(DEFAULT_GUIDE_COUNTRY);
  const [date, setDate] = useState(() => ymd(new Date()));
  const [favs, setFavs] = useState<string[]>([]);
  const [onlyFavs, setOnlyFavs] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Hydrate persisted choices after mount (localStorage is client-only).
  useEffect(() => {
    const c = localStorage.getItem("guide:country");
    if (c) setCountry(c);
  }, []);
  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem(`guide:favs:${country}`) ?? "[]"));
    } catch {
      setFavs([]);
    }
  }, [country]);

  function pickCountry(c: string) {
    setCountry(c);
    localStorage.setItem("guide:country", c);
  }
  function toggleFav(channel: string) {
    setFavs((prev) => {
      const next = prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel];
      localStorage.setItem(`guide:favs:${country}`, JSON.stringify(next));
      return next;
    });
  }

  const { data, isFetching, isError } = useQuery({
    queryKey: ["guide", country, date],
    queryFn: async () => {
      const res = await fetch(`/api/v1/guide?country=${country}&date=${date}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ channels: GuideChannel[] }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const allChannels = data?.channels ?? [];
  const favsActive = onlyFavs && favs.length > 0;
  const shown = favsActive
    ? allChannels.filter((c) => favs.includes(c.channel))
    : allChannels;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          Region
          <select
            value={country}
            onChange={(e) => pickCountry(e.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text focus:outline-2 focus:outline-accent"
          >
            {GUIDE_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text hover:border-accent"
        >
          {pickerOpen ? "Done choosing" : favs.length > 0 ? `My channels (${favs.length})` : "Choose channels"}
        </button>
        {favs.length > 0 && (
          <label className="flex items-center gap-1.5 text-sm text-text-muted">
            <input type="checkbox" checked={onlyFavs} onChange={(e) => setOnlyFavs(e.target.checked)} />
            Only my channels
          </label>
        )}
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((d, i) => {
          const v = ymd(d);
          const active = v === date;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setDate(v)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-surface text-text-muted hover:border-accent hover:text-text"
              }`}
            >
              {dayLabel(d, i)}
            </button>
          );
        })}
      </div>

      {/* Channel picker */}
      {pickerOpen && (
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            Tap to pick the channels you care about
          </p>
          {allChannels.length === 0 ? (
            <p className="text-sm text-text-muted">Load a region with listings to choose channels.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allChannels.map((c) => {
                const on = favs.includes(c.channel);
                return (
                  <button
                    key={c.channel}
                    type="button"
                    onClick={() => toggleFav(c.channel)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      on
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-surface text-text-muted hover:border-accent"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {c.channel}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Listings */}
      {isFetching ? (
        <p className="text-sm text-text-muted">Loading the schedule…</p>
      ) : isError ? (
        <p className="text-sm text-text-muted">Couldn&apos;t load the schedule. Try again shortly.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-text-muted">
          {favsActive && allChannels.length > 0
            ? "None of your chosen channels have listings for this day. Toggle off “Only my channels” to see everything."
            : "No listings for this region on this day. TVmaze covers some regions sparsely."}
        </p>
      ) : (
        <div className="space-y-6">
          {shown.map((c) => (
            <section key={c.channel}>
              <h2 className="mb-2 border-b border-border pb-1 text-sm font-semibold text-text">
                {c.channel}
              </h2>
              <ul className="divide-y divide-border">
                {c.entries.map((e) => {
                  const onNow = isOnNow(e.airstamp, e.runtime);
                  return (
                    <li
                      key={e.id}
                      className={`flex gap-3 py-2 ${onNow ? "rounded-md bg-accent/10 px-2" : ""}`}
                    >
                      <div className="w-12 shrink-0 text-sm font-medium text-text-muted">
                        {e.time ?? "--"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <Link href={e.searchHref} className="text-sm font-medium text-text hover:text-accent">
                            {e.showName}
                          </Link>
                          {e.season != null && e.episode != null && (
                            <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
                              S{e.season} E{e.episode}
                            </span>
                          )}
                          {onNow && (
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                              On now
                            </span>
                          )}
                        </div>
                        {e.episodeTitle && e.episodeTitle !== e.showName && (
                          <p className="text-xs text-text">{e.episodeTitle}</p>
                        )}
                        {e.synopsis && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{e.synopsis}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
