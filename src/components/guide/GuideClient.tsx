"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  GUIDE_COUNTRIES,
  GUIDE_PLUTO,
  GUIDE_XUMO,
  GUIDE_PLEX,
  DEFAULT_GUIDE_COUNTRY,
} from "@/lib/guide/countries";
import { meFetch } from "@/lib/me-client";
import type { GuideChannel, GuideEntry } from "@/services/guide";

const isStreamingCode = (c: string) => /^(PLUTO_|XUMO|PLEX_)/i.test(c);

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
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Signed-in users sync their channel picks to the DB so the choice carries
  // across devices; guests fall back to localStorage only.
  const { isSignedIn, isLoaded } = useAuth();
  const dbMap = useRef<Record<string, string[]> | null>(null);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Broadcast vs Streaming switcher — only one region dropdown shows at a time.
  const [mode, setMode] = useState<"broadcast" | "streaming">("broadcast");
  const lastBroadcast = useRef(DEFAULT_GUIDE_COUNTRY);
  const lastStreaming = useRef(GUIDE_PLUTO[0]?.code ?? "PLUTO_US");

  const localFavs = (c: string): string[] => {
    try {
      return JSON.parse(localStorage.getItem(`guide:favs:${c}`) ?? "[]");
    } catch {
      return [];
    }
  };

  useEffect(() => {
    const c = localStorage.getItem("guide:country");
    if (c) {
      setCountry(c);
      if (isStreamingCode(c)) {
        setMode("streaming");
        lastStreaming.current = c;
      } else {
        lastBroadcast.current = c;
      }
    }
  }, []);

  // Load the saved DB picks once (signed-in), then reflect the current region.
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      dbMap.current = null;
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await meFetch<{ channels: Record<string, string[]> }>("/api/v1/me/guide-channels");
        if (!active) return;
        dbMap.current = res.channels ?? {};
        setDbLoaded(true);
      } catch {
        /* offline / not signed in — keep localStorage behaviour */
      }
    })();
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn]);

  // Reflect the active region's picks (DB first, then localStorage). Re-runs
  // when the DB load completes so signed-in picks replace the localStorage seed.
  useEffect(() => {
    setFavs(dbMap.current?.[country] ?? localFavs(country));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, dbLoaded]);

  function pickCountry(c: string) {
    setCountry(c);
    localStorage.setItem("guide:country", c);
    if (isStreamingCode(c)) lastStreaming.current = c;
    else lastBroadcast.current = c;
  }
  function switchMode(m: "broadcast" | "streaming") {
    if (m === mode) return;
    setMode(m);
    // Streaming (FAST) channels are 24/7 loops with no prime-time block, so
    // clear that filter to avoid it silently hiding streaming listings.
    if (m === "streaming") setPrimeOnly(false);
    pickCountry(m === "broadcast" ? lastBroadcast.current : lastStreaming.current);
  }
  const toggleFav = useCallback(
    (channel: string) => {
      setFavs((prev) => {
        const next = prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel];
        localStorage.setItem(`guide:favs:${country}`, JSON.stringify(next));
        if (isSignedIn) {
          if (dbMap.current) dbMap.current[country] = next;
          meFetch("/api/v1/me/guide-channels", {
            method: "PUT",
            body: { country, channels: next },
          }).catch(() => {});
        }
        return next;
      });
    },
    [country, isSignedIn],
  );

  const { data, isFetching, isError } = useQuery({
    queryKey: ["guide", country, date],
    queryFn: async () => {
      const res = await fetch(`/api/v1/guide?country=${country}&date=${date}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ channels: GuideChannel[] }>;
    },
    staleTime: 30 * 60 * 1000,
  });

  const allChannels = useMemo(() => data?.channels ?? [], [data]);
  const favsActive = onlyFavs && favs.length > 0;
  const favSet = useMemo(() => new Set(favs), [favs]);

  // Favourites filter first. In "All" mode this returns the SAME array reference
  // regardless of favs, so toggling a favourite doesn't rebuild the listings.
  const filtered = useMemo(
    () => (favsActive ? allChannels.filter((c) => favSet.has(c.channel)) : allChannels),
    [allChannels, favsActive, favSet],
  );
  // Then prime-time + empties. Stable unless `filtered`/primeOnly change.
  const shown: GuideChannel[] = useMemo(
    () =>
      filtered
        .map((c) => ({ channel: c.channel, entries: primeOnly ? c.entries.filter(inPrime) : c.entries }))
        .filter((c) => c.entries.length > 0),
    [filtered, primeOnly],
  );

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Keep the source toggle + region dropdown on one line, even on mobile. */}
        <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-9 shrink-0 overflow-hidden rounded-md border border-border">
          {(["broadcast", "streaming"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`px-3 text-sm font-medium transition-colors ${
                mode === m ? "bg-accent text-white" : "bg-surface text-text-muted hover:text-text"
              }`}
            >
              {m === "broadcast" ? "Broadcast" : "Streaming"}
            </button>
          ))}
        </div>
        {mode === "broadcast" ? (
          <select
            aria-label="Broadcast region"
            value={isStreamingCode(country) ? "" : country}
            onChange={(e) => e.target.value && pickCountry(e.target.value)}
            className="h-9 min-w-0 rounded-md border border-border bg-surface px-2 text-sm text-text focus:outline-2 focus:outline-accent"
          >
            <option value="" disabled>
              Broadcast region
            </option>
            {GUIDE_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            aria-label="Streaming service"
            value={isStreamingCode(country) ? country : ""}
            onChange={(e) => e.target.value && pickCountry(e.target.value)}
            className="h-9 min-w-0 rounded-md border border-border bg-surface px-2 text-sm text-text focus:outline-2 focus:outline-accent"
          >
            <option value="" disabled>
              Streaming service
            </option>
            <optgroup label="Pluto TV">
              {GUIDE_PLUTO.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name.replace(/^Pluto TV /, "Pluto ")}
                </option>
              ))}
            </optgroup>
            <optgroup label="Xumo">
              {GUIDE_XUMO.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Plex">
              {GUIDE_PLEX.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name.replace(/^Plex /, "Plex ")}
                </option>
              ))}
            </optgroup>
          </select>
        )}
        </div>

        <span className="ml-auto flex items-center gap-2">
          {mode === "broadcast" && (
            <button
              type="button"
              onClick={() => setPrimeOnly((p) => !p)}
              className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
                primeOnly ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface text-text-muted hover:border-accent"
              }`}
            >
              Prime time
            </button>
          )}
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

      {/* Channel picker — a retractable card. The title itself is the toggle;
          the "Guide shows" filter stays visible even when collapsed. */}
      <div className="rounded-lg border border-border bg-surface-raised p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-expanded={pickerOpen}
            className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted transition-colors hover:text-text"
          >
            <span className={`transition-transform ${pickerOpen ? "rotate-90" : ""}`} aria-hidden>
              ▸
            </span>
            {pickerOpen ? "Click to close favourites" : "Click to select favourites"}
          </button>
          {favs.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              Guide shows
              <div className="flex h-7 shrink-0 overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setOnlyFavs(false)}
                  className={`px-2 font-medium transition-colors ${
                    !onlyFavs ? "bg-accent text-white" : "bg-surface text-text-muted hover:text-text"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setOnlyFavs(true)}
                  className={`px-2 font-medium transition-colors ${
                    onlyFavs ? "bg-accent text-white" : "bg-surface text-text-muted hover:text-text"
                  }`}
                >
                  Favourites
                </button>
              </div>
            </div>
          )}
        </div>
        {pickerOpen &&
          (allChannels.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">Load a region with listings to choose channels.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {allChannels.map((c) => {
                const on = favSet.has(c.channel);
                return (
                  <button
                    key={c.channel}
                    type="button"
                    onClick={() => toggleFav(c.channel)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      on
                        ? "border-success bg-success/15 text-success"
                        : "border-border bg-surface text-text-muted hover:border-accent"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {c.channel}
                  </button>
                );
              })}
            </div>
          ))}
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
        <GuideGrid channels={shown} favs={favs} onToggleFav={toggleFav} />
      ) : (
        <GuideList channels={shown} />
      )}

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-6 z-40 flex size-11 items-center justify-center rounded-full border border-border bg-surface-raised text-lg text-text shadow-overlay transition-colors hover:border-accent hover:text-accent"
        >
          ↑
        </button>
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

const GuideList = memo(function GuideList({ channels }: { channels: GuideChannel[] }) {
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
});

const PX_PER_MIN = 4;
const ROW_H = 56;
const LABEL_W = 104;

// One channel row. Memoised on `isFav`/`selectedId` so toggling a favourite
// (which changes one row's isFav) re-renders only that row, not the whole grid.
const GridRow = memo(function GridRow({
  channel,
  isFav,
  onToggleFav,
  startMin,
  width,
  nowX,
  selectedId,
  onSelect,
}: {
  channel: GuideChannel;
  isFav: boolean;
  onToggleFav: (channel: string) => void;
  startMin: number;
  width: number;
  nowX: number | null;
  selectedId: string | number | null;
  onSelect: (sel: { channel: string; entry: GuideEntry }) => void;
}) {
  return (
    <div className="flex border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => onToggleFav(channel.channel)}
        title={isFav ? "Remove from your channels" : "Add to your channels"}
        className={`sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r border-border px-2 text-left text-xs font-semibold transition-colors ${
          isFav ? "bg-success/20 text-success" : "bg-surface text-text hover:bg-surface-overlay"
        }`}
        style={{ width: LABEL_W, height: ROW_H }}
      >
        {isFav && <span aria-hidden>✓</span>}
        <span className="line-clamp-2">{channel.channel}</span>
      </button>
      <div className="relative" style={{ width, height: ROW_H }}>
        {nowX != null && <div className="absolute top-0 z-20 h-full w-px bg-danger/70" style={{ left: nowX }} />}
        {channel.entries.map((e) => {
          const s = timeToMin(e.time);
          if (s == null) return null;
          const w = Math.max((e.runtime && e.runtime > 0 ? e.runtime : 30) * PX_PER_MIN, 36);
          const on = isOnNow(e);
          const sel = selectedId === e.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelect({ channel: channel.channel, entry: e })}
              title={`${e.time ?? ""} ${e.showName}`}
              className={`absolute top-1 bottom-1 overflow-hidden rounded border px-1.5 py-1 text-left text-[11px] leading-tight transition-colors ${
                sel
                  ? "border-accent bg-accent/30 text-text ring-2 ring-accent"
                  : on
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
            </button>
          );
        })}
      </div>
    </div>
  );
});

const GuideGrid = memo(function GuideGrid({
  channels,
  favs,
  onToggleFav,
}: {
  channels: GuideChannel[];
  favs: string[];
  onToggleFav: (channel: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const favSet = useMemo(() => new Set(favs), [favs]);
  const [selected, setSelected] = useState<{ channel: string; entry: GuideEntry } | null>(null);

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
  // Round to whole pixels so sub-second Date.now() drift doesn't change the prop
  // on every render (which would re-render every memoised row).
  const nowX =
    nowMin != null && nowMin >= startMin && nowMin <= endMin
      ? Math.round((nowMin - startMin) * PX_PER_MIN)
      : null;

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
    <div className="space-y-2">
      {selected && (
        <div className="sticky top-16 z-30 rounded-lg border border-accent/40 bg-surface-raised p-3 shadow-overlay">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-text-muted">
                {selected.channel}
                {selected.entry.time ? ` · ${selected.entry.time}` : ""}
                {isOnNow(selected.entry) ? " · On now" : ""}
              </p>
              <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-text">
                {selected.entry.showName}
                {selected.entry.season != null && selected.entry.episode != null && (
                  <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
                    S{selected.entry.season} E{selected.entry.episode}
                  </span>
                )}
              </h3>
              {selected.entry.episodeTitle && selected.entry.episodeTitle !== selected.entry.showName && (
                <p className="text-xs text-text">{selected.entry.episodeTitle}</p>
              )}
              {selected.entry.synopsis && (
                <p className="mt-1 text-xs text-text-muted">{selected.entry.synopsis}</p>
              )}
              <Link
                href={selected.entry.href}
                className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
              >
                View full details →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close details"
              className="shrink-0 rounded px-2 py-1 text-text-muted hover:text-text"
            >
              ✕
            </button>
          </div>
        </div>
      )}
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
          <GridRow
            key={c.channel}
            channel={c}
            isFav={favSet.has(c.channel)}
            onToggleFav={onToggleFav}
            startMin={startMin}
            width={width}
            nowX={nowX}
            selectedId={selected?.entry.id ?? null}
            onSelect={setSelected}
          />
        ))}
        </div>
      </div>
    </div>
  );
});
