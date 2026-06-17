"use client";
import { useEffect, useState } from "react";

interface TitleResult {
  kind: "title";
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
}

/** Debounced title search → dropdown → onPick. Reused for picking/changing a vote. */
export function MoviePicker({
  placeholder,
  disabled,
  onPick,
}: {
  placeholder: string;
  disabled?: boolean;
  onPick: (r: { mediaType: "movie" | "tv"; tmdbId: number; title: string }) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TitleResult[]>([]);

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

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-border bg-surface px-4 text-sm text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent disabled:opacity-50"
      />
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-surface-raised py-1 shadow-overlay">
          {results.map((r) => (
            <button
              key={`${r.mediaType}-${r.tmdbId}`}
              type="button"
              onClick={() => {
                onPick({ mediaType: r.mediaType, tmdbId: r.tmdbId, title: r.title });
                setQ("");
                setResults([]);
              }}
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
  );
}
