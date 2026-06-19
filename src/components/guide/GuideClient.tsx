"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { GUIDE_COUNTRIES, GUIDE_PLUTO, DEFAULT_GUIDE_COUNTRY } from "@/lib/guide/countries";
import type { GuideChannel, GuideEntry } from "@/services/guide";

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function nextDays(n: number): Date[] {
  const base = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}

function dayLabel(d: Date, i: number): string {
  if (i === 0) return "Today";
  if (i === 1) return "Tomorrow";
  return d.toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" });
}

function timeToMin(t: string | null): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const PRIME_START = 18 * 60; // 18:00
const PRIME_END = 23 * 60; // 23:00

function inPrime(e: GuideEntry): boolean {
  const m = timeToMin(e.time);
  return m != null && m >= PRIME_START && m < PRIME_END;
}

function isOnNow(e: GuideEntry): boolean {
  if (!e.airstamp) return false;
  const start = Date.parse(e.airstamp);
  if (Number.isNaN(start)) return false;
  const end = start + (e.runtime && e.runtime > 0 ? e.runtime : 30) * 60_000;
  const now = Date.now();
  return now >= start && now < end;
}

/** Current clock-minutes in the schedule's own timezone, derived from any entry's
 *  absolute timestamp + local time, so it's correct even when the viewer is elsewhere. */
function nowLocalMinutes(channels: GuideChannel[]): number | null {
  for (const c of channels) {
    for (const e of c.entries) {
      const lm = timeToMin(e.time);
      if (lm != null && e.airstamp) {
        const ms = Date.parse(e.airstamp);
        if (!Number.isNaN(ms)) return lm + (Date.now() - ms) / 60_000;
      }
    }
  }
  return null;
}

export function GuideClient() {
  const days = useMemo(() => nextDays(7), []);
  const [country, setCountry] = useState(DEFAULT_GUIDE_COUNTRY);
  const [date, setDate] = useState(() => ymd(new Date()));
  const [favs, setFavs] = useState<string[]>([]);
  const [onlyFavs, setOnlyFavs] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(true); // open by default so picking is obvious
  const [view, setView] = useState<"list" | "grid">("list");
  const [primeOnly, setPrimeOnly] = useState(false);

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
    staleTime: 30 * 60 * 1000,
  });

  const allChannels = data?.channels ?? [];
  const favsActive = onlyFavs && favs.length > 0;

  // Apply favourites + prime-time filters.
  const shown: GuideChannel[] = allChannels
    .filter((c) => !favsActive || favs.includes(c.channel))
    .map((c) => ({ channel: c.channel, entries: primeOnly ? c.entries.filter(inPrime) : c.entries }))
    .filter((c) => c.entries.length > 0);

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
            <optgroup label="Broadcast TV">
              {GUIDE_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Free streaming">
              {GUIDE_PLUTO.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </optgroup>
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

        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPrimeOnly((p) => !p)}
            className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
              primeOnly ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface text-text-muted hover:border-accent"
            }`}
          >
            Prime time
          </button>
          <div className="flex h-9 overflow-hidden rounded-md border border-border">
            {(["list", "grid"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 text-sm font-medium transition-colors ${
                  view === v ? "bg-accent text-white" : "bg-surface text-text-muted hover:text-text"
                }`}
              >
                {v === "list" ? "List" : "Grid"}
              </button>
            ))}
          </div>
        </span>
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
                      on ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface text-text-muted hover:border-accent"
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
            ? "Nothing for your chosen channels here. Turn off “Only my channels”, or clear the Prime time filter."
            : "No listings for this region on this day. TVmaze covers some regions sparsely."}
        </p>
      ) : view === "grid" ? (
        <GuideGrid channels={shown} />
      ) : (
        <GuideList channels={shown} />
      )}
    </div>
  );
}

function EntryMeta({ e }: { e: GuideEntry }) {
  return (
    <>
      {e.season != null && e.episode != null && (
        <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
          S{e.season} E{e.episode}
        </span>
      )}
      {isOnNow(e) && (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">On now</span>
      )}
    </>
  );
}

function GuideList({ channels }: { channels: GuideChannel[] }) {
  return (
    <div className="space-y-6">
      {channels.map((c) => (
        <section key={c.channel}>
          <h2 className="mb-2 border-b border-border pb-1 text-sm font-semibold text-text">{c.channel}</h2>
          <ul className="divide-y divide-border">
            {c.entries.map((e) => (
              <li key={e.id} className={`flex gap-3 py-2 ${isOnNow(e) ? "rounded-md bg-accent/10 px-2" : ""}`}>
                <div className="w-12 shrink-0 text-sm font-medium text-text-muted">{e.time ?? "--"}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={e.href} className="text-sm font-medium text-text hover:text-accent">
                      {e.showName}
                    </Link>
                    <EntryMeta e={e} />
                  </div>
                  {e.episodeTitle && e.episodeTitle !== e.showName && (
                    <p className="text-xs text-text">{e.episodeTitle}</p>
                  )}
                  {e.synopsis && <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{e.synopsis}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const PX_PER_MIN = 4;
const ROW_H = 56;
const LABEL_W = 104;

function GuideGrid({ channels }: { channels: GuideChannel[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  // Time window covering all shown entries (floored/ceiled to the hour).
  const { startMin, endMin } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of channels)
      for (const e of c.entries) {
        const s = timeToMin(e.time);
        if (s == null) continue;
        lo = Math.min(lo, s);
        hi = Math.max(hi, s + (e.runtime && e.runtime > 0 ? e.runtime : 30));
      }
    if (!Number.isFinite(lo)) return { startMin: 0, endMin: 24 * 60 };
    return { startMin: Math.floor(lo / 60) * 60, endMin: Math.ceil(hi / 60) * 60 };
  }, [channels]);

  const width = (endMin - startMin) * PX_PER_MIN;
  const nowMin = nowLocalMinutes(channels);
  const nowX = nowMin != null && nowMin >= startMin && nowMin <= endMin ? (nowMin - startMin) * PX_PER_MIN : null;

  const hours: number[] = [];
  for (let h = startMin; h <= endMin; h += 60) hours.push(h);

  // Auto-scroll so "now" is in view on first render.
  useEffect(() => {
    if (nowX != null && scroller.current) {
      scroller.current.scrollLeft = Math.max(0, nowX - 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  return (
    <div ref={scroller} className="overflow-x-auto rounded-lg border border-border">
      <div style={{ width: LABEL_W + width }}>
        {/* Hour ruler */}
        <div className="flex border-b border-border bg-surface-raised">
          <div className="shrink-0 border-r border-border" style={{ width: LABEL_W, height: 24 }} />
          <div className="relative" style={{ width, height: 24 }}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute top-0 text-[11px] text-text-muted"
                style={{ left: (h - startMin) * PX_PER_MIN + 2 }}
              >
                {String(Math.floor((h % 1440) / 60)).padStart(2, "0")}:00
              </span>
            ))}
            {nowX != null && <div className="absolute top-0 z-20 h-6 w-px bg-danger" style={{ left: nowX }} />}
          </div>
        </div>

        {/* Channel rows */}
        {channels.map((c) => (
          <div key={c.channel} className="flex border-b border-border last:border-b-0">
            <div
              className="sticky left-0 z-10 flex shrink-0 items-center border-r border-border bg-surface px-2 text-xs font-semibold text-text"
              style={{ width: LABEL_W, height: ROW_H }}
            >
              <span className="line-clamp-2">{c.channel}</span>
            </div>
            <div className="relative" style={{ width, height: ROW_H }}>
              {nowX != null && <div className="absolute top-0 z-20 h-full w-px bg-danger/70" style={{ left: nowX }} />}
              {c.entries.map((e) => {
                const s = timeToMin(e.time);
                if (s == null) return null;
                const w = Math.max((e.runtime && e.runtime > 0 ? e.runtime : 30) * PX_PER_MIN, 36);
                const on = isOnNow(e);
                return (
                  <Link
                    key={e.id}
                    href={e.href}
                    title={`${e.time ?? ""} ${e.showName}`}
                    className={`absolute top-1 bottom-1 overflow-hidden rounded border px-1.5 py-1 text-[11px] leading-tight transition-colors ${
                      on
                        ? "border-accent bg-accent/20 text-text"
                        : "border-border bg-surface-raised text-text-muted hover:border-accent hover:text-text"
                    }`}
                    style={{ left: (s - startMin) * PX_PER_MIN, width: w - 2 }}
                  >
                    <span className="block truncate font-medium text-text">{e.showName}</span>
                    <span className="block truncate">
                      {e.time}
                      {e.season != null && e.episode != null ? ` · S${e.season}E${e.episode}` : ""}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
