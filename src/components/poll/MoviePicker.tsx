"use client";
import { useEffect, useState } from "react";
import { ListEpisodePicker } from "@/components/account/ListEpisodePicker";

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
  onPick: (r: {
    mediaType: "movie" | "tv";
    tmdbId: number;
    title: string;
    seasonNumber?: number;
    episodeNumber?: number;
  }) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TitleResult[]>([]);
  // The show whose episode list is open (from a TV search result).
  const [episodeShow, setEpisodeShow] = useState<TitleResult | null>(null);

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
          {results.map((r) => {
            const pickerOpen = episodeShow?.tmdbId === r.tmdbId && episodeShow?.mediaType === r.mediaType;
            return (
              <div key={`${r.mediaType}-${r.tmdbId}`}>
                <div className="flex w-full items-center gap-3 px-3 py-1.5 hover:bg-surface-overlay">
                  <button
                    type="button"
                    onClick={() => {
                      onPick({ mediaType: r.mediaType, tmdbId: r.tmdbId, title: r.title });
                      setQ("");
                      setResults([]);
                      setEpisodeShow(null);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
                  {r.mediaType === "tv" && (
                    <button
                      type="button"
                      onClick={() => setEpisodeShow(pickerOpen ? null : r)}
                      className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text hover:bg-surface-overlay"
                    >
                      {pickerOpen ? "Close" : "Episodes"}
                    </button>
                  )}
                </div>
                {pickerOpen && (
                  <div className="px-3 pb-3">
                    <ListEpisodePicker
                      tvId={r.tmdbId}
                      showTitle={r.title}
                      // A poll has no "already added" concept, each voter holds exactly one
                      // pick at a time, so there is nothing to mark as already-have here.
                      have={new Set()}
                      onAdd={(ep) => {
                        onPick({
                          mediaType: "tv",
                          tmdbId: r.tmdbId,
                          title: `${r.title}: S${ep.seasonNumber}E${ep.episodeNumber} ${ep.name}`,
                          seasonNumber: ep.seasonNumber,
                          episodeNumber: ep.episodeNumber,
                        });
                        setEpisodeShow(null);
                      }}
                      onClose={() => setEpisodeShow(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
