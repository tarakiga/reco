"use client";
import { useEffect, useState } from "react";

export interface EpisodeResult {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string;
  matchedOn: string | null;
  aiReason?: string;
}

/** Inline episode finder for one show, used while building a list. Searches the
 *  show's episodes (reusing /api/v1/tv/[id]/find-episode, AI fallback included)
 *  and offers each as an "Add" to the list. `have` holds "season:episode" keys
 *  already on the list so they show as added. */
export function ListEpisodePicker({
  tvId,
  showTitle,
  have,
  onAdd,
  onClose,
}: {
  tvId: number;
  showTitle: string;
  have: Set<string>;
  onAdd: (ep: EpisodeResult) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<EpisodeResult[]>([]);
  const [guesses, setGuesses] = useState<EpisodeResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setGuesses([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/tv/${tvId}/find-episode?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
        setGuesses(data.guesses ?? []);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, tvId]);

  function row(ep: EpisodeResult, isGuess: boolean) {
    const key = `${ep.seasonNumber}:${ep.episodeNumber}`;
    const added = have.has(key);
    const reason = isGuess ? ep.aiReason : ep.matchedOn;
    return (
      <li key={key} className="flex items-start gap-3 px-3 py-2">
        <span className="mt-0.5 shrink-0 rounded bg-surface-overlay px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">
          S{ep.seasonNumber} E{ep.episodeNumber}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{ep.name}</p>
          {reason ? (
            <p className="truncate text-xs text-accent">{reason}</p>
          ) : ep.overview ? (
            <p className="truncate text-xs text-text-muted">{ep.overview}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onAdd(ep)}
          disabled={added}
          className="shrink-0 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {added ? "Added" : "Add"}
        </button>
      </li>
    );
  }

  return (
    <div className="rounded-md border border-accent/40 bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-text">
          Add episodes of <span className="text-accent">{showTitle}</span>
        </p>
        <button type="button" onClick={onClose} aria-label="Close episode picker" className="rounded px-2 py-0.5 text-text-muted hover:text-text">
          ✕
        </button>
      </div>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search this show's episodes (title, plot, a guest star…)"
        className="h-8 w-full rounded-md border border-border bg-surface-raised px-3 text-xs text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
      />
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border bg-surface-raised">
          {results.map((ep) => row(ep, false))}
        </ul>
      )}
      {results.length === 0 && guesses.length > 0 && (
        <>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">Best guesses</p>
          <ul className="mt-1 divide-y divide-border overflow-hidden rounded-md border border-border bg-surface-raised">
            {guesses.map((ep) => row(ep, true))}
          </ul>
        </>
      )}
      {!loading && q.trim().length >= 2 && results.length === 0 && guesses.length === 0 && (
        <p className="mt-2 text-xs text-text-muted">No episodes matched. Try a different word.</p>
      )}
    </div>
  );
}
