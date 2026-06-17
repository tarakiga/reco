"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useToast } from "@/components/ui/Toast";

interface DiaryDate {
  id: string;
  watchedOn: string;
}

const fmt = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
const today = () => new Date().toISOString().slice(0, 10);

/** "I have seen this" → pick a date → it's logged to your diary (rewatches allowed). */
export function DiaryButton({ mediaType, tmdbId }: { mediaType: "movie" | "tv"; tmdbId: number }) {
  const { isSignedIn } = useAuth();
  const toast = useToast();
  const [dates, setDates] = useState<DiaryDate[]>([]);
  const [picking, setPicking] = useState(false);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setReady(true);
      return;
    }
    fetch(`/api/v1/me/diary?mediaType=${mediaType}&tmdbId=${tmdbId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDates(d.dates))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [isSignedIn, mediaType, tmdbId]);

  useEffect(() => {
    if (picking && inputRef.current?.showPicker) {
      try {
        inputRef.current.showPicker();
      } catch {
        /* needs a tap on some browsers */
      }
    }
  }, [picking]);

  async function log(date: string) {
    if (!date) return;
    try {
      const d = await (
        await fetch("/api/v1/me/diary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mediaType, tmdbId, date }),
        })
      ).json();
      if (d.entry) {
        setDates((ds) =>
          [d.entry, ...ds.filter((x) => x.id !== d.entry.id)].sort((a, b) =>
            b.watchedOn.localeCompare(a.watchedOn),
          ),
        );
      }
      toast({ title: "Added to your diary", variant: "success" });
    } catch {
      toast({ title: "Couldn't log it", variant: "danger" });
    } finally {
      setPicking(false);
    }
  }

  async function remove(id: string) {
    setDates((ds) => ds.filter((x) => x.id !== id));
    try {
      await fetch("/api/v1/me/diary", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId: id }),
      });
    } catch {
      /* ignore */
    }
  }

  if (!ready || !isSignedIn) return null;

  const datePicker = (size: "sm" | "md") => (
    <input
      ref={inputRef}
      type="date"
      max={today()}
      defaultValue={today()}
      autoFocus
      onChange={(e) => log(e.target.value)}
      className={`rounded-md border border-border bg-surface px-2 text-text [color-scheme:dark] ${
        size === "sm" ? "h-8 text-xs" : "h-9 text-sm px-3"
      }`}
    />
  );

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <p className="mb-2 text-sm font-medium text-text">I have seen this</p>
      {dates.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {dates.map((d) => (
            <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
              <span className="font-medium text-text">✓ {fmt(d.watchedOn)}</span>
              <button type="button" onClick={() => remove(d.id)} aria-label="Remove date" className="text-text-muted hover:text-danger">
                ×
              </button>
            </span>
          ))}
          {picking ? (
            datePicker("sm")
          ) : (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-text"
            >
              + another date
            </button>
          )}
        </div>
      ) : picking ? (
        datePicker("md")
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex h-9 items-center rounded-md bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          When?
        </button>
      )}
    </div>
  );
}
