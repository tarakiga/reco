"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { meFetch } from "@/lib/me-client";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { DatePicker } from "@/components/ui/DatePicker";
import type { DiaryEntry } from "@/services/diary";

interface TitleResult {
  kind: "title";
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en", { weekday: "short", year: "numeric", month: "short", day: "numeric" });

export function DiaryManager({ initial }: { initial: DiaryEntry[] }) {
  const toast = useToast();
  const [entries, setEntries] = useState(initial);
  const [date, setDate] = useState(today());
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TitleResult[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const d = await (await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })).json();
        setResults((d.results ?? []).filter((r: { kind: string }) => r.kind === "title").slice(0, 6));
      } catch {
        /* aborted */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  async function add(r: TitleResult) {
    try {
      const d = await meFetch<{ entry: { id: string; watchedOn: string } }>("/api/v1/me/diary", {
        method: "POST",
        body: { mediaType: r.mediaType, tmdbId: r.tmdbId, date },
      });
      const entry: DiaryEntry = {
        id: d.entry.id,
        tmdbId: r.tmdbId,
        mediaType: r.mediaType,
        title: r.title,
        year: r.year,
        posterUrl: r.posterUrl,
        href: r.href,
        watchedOn: d.entry.watchedOn,
      };
      setEntries((es) =>
        [entry, ...es.filter((e) => e.id !== entry.id)].sort((a, b) => b.watchedOn.localeCompare(a.watchedOn)),
      );
      setQ("");
      setResults([]);
      toast({ title: `Logged ${r.title}`, variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't log it", variant: "danger" });
    }
  }

  async function remove(id: string) {
    setConfirmId(null);
    setEntries((es) => es.filter((e) => e.id !== id));
    try {
      await meFetch("/api/v1/me/diary", { method: "DELETE", body: { entryId: id } });
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border bg-surface-raised p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 text-xs text-text-muted">
            Date watched
            <DatePicker value={date} onChange={setDate} max={today()} />
          </div>
          <div className="relative min-w-[220px] flex-1">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Add a title you watched
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search to log a watch…"
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
              />
            </label>
            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-surface-raised py-1 shadow-overlay">
                {results.map((r) => (
                  <button
                    key={`${r.mediaType}-${r.tmdbId}`}
                    type="button"
                    onClick={() => add(r)}
                    className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-surface-overlay"
                  >
                    <div className="aspect-2/3 w-8 shrink-0 overflow-hidden rounded border border-border bg-surface-overlay">
                      {r.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.posterUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <span className="truncate text-sm text-text">
                      {r.title}
                      {r.year ? ` (${r.year})` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="Your diary is empty"
          description="Log what you've watched — from any title's page (the “When?” button) or by searching above."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2">
              <Link href={e.href} className="aspect-2/3 w-9 shrink-0 overflow-hidden rounded border border-border bg-surface-overlay">
                {e.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <Link href={e.href} className="font-medium text-text hover:text-accent">
                    {e.title}
                  </Link>
                  {e.year && <span className="ml-1 text-xs text-text-muted">{e.year}</span>}
                </p>
              </div>
              <span className="shrink-0 text-xs text-text-muted">{fmt(e.watchedOn)}</span>
              {confirmId === e.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    className="rounded-md bg-danger px-2.5 py-1 text-xs font-medium text-white"
                  >
                    Sure?
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text hover:bg-surface-overlay"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(e.id)}
                  aria-label="Remove entry"
                  className="shrink-0 rounded px-2 py-1 text-danger hover:text-danger/80"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
