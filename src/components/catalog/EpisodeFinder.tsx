"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { EpisodeMatch } from "@/lib/tmdb/episodes";

function ResultRow({ ep }: { ep: EpisodeMatch }) {
  return (
    <li className="flex gap-3">
      <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-md border border-border bg-surface-overlay">
        {ep.stillUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ep.stillUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="truncate text-sm font-medium text-text">
            S{ep.seasonNumber} E{ep.episodeNumber} · {ep.name}
          </h4>
          {ep.voteAverage ? (
            <span className="shrink-0 text-xs font-medium text-warning">★ {ep.voteAverage.toFixed(1)}</span>
          ) : null}
        </div>
        {ep.aiReason ? (
          <span className="mt-1 inline-flex rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
            AI best guess
          </span>
        ) : ep.matchedOn ? (
          <span className="mt-1 inline-flex rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
            {ep.matchedOn}
          </span>
        ) : null}
        {ep.aiReason && <p className="mt-1 text-xs italic text-text-muted">Why: {ep.aiReason}</p>}
        {ep.overview && <p className="mt-1 text-sm text-text-muted">{ep.overview}</p>}
        {ep.cast.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ep.cast.map((c) => (
              <a
                key={c.id}
                href={c.href}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface py-0.5 pl-0.5 pr-2 text-xs transition-colors hover:border-accent"
                title={c.character ? `${c.name} as ${c.character}` : c.name}
              >
                <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-overlay text-[9px] text-text-muted">
                  {c.profileUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.profileUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    c.name.slice(0, 1)
                  )}
                </span>
                <span className="text-text">{c.name}</span>
                {c.character && <span className="text-text-muted">as {c.character}</span>}
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export function EpisodeFinder({ tvId }: { tvId: number }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const { data, isFetching, isError } = useQuery({
    queryKey: ["find-episode", tvId, query],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tv/${tvId}/find-episode?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json() as Promise<{ results: EpisodeMatch[]; guesses?: EpisodeMatch[] }>;
    },
    enabled: query.length >= 2,
    staleTime: 60 * 60 * 1000,
  });
  const results = data?.results ?? [];
  const guesses = data?.guesses ?? [];

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface-raised p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3"
      >
        <div className="flex-1">
          <Input
            name="episode-q"
            label="Find the episode"
            placeholder="Search by episode title, character or guest star"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1 sm:flex-none">Search</Button>
          {query && (
            <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={() => { setInput(""); setQuery(""); }}>
              Clear
            </Button>
          )}
        </div>
      </form>

      {query.length >= 2 && (
        <div className="mt-4">
          {isFetching ? (
            <p className="text-sm text-text-muted">Searching every episode…</p>
          ) : isError ? (
            <p className="text-sm text-text-muted">Couldn&apos;t search episodes. Try again later.</p>
          ) : results.length > 0 ? (
            <>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">
                {results.length} {results.length === 1 ? "match" : "matches"}
              </p>
              <ul className="space-y-3">
                {results.map((ep) => (
                  <ResultRow key={`${ep.seasonNumber}-${ep.episodeNumber}`} ep={ep} />
                ))}
              </ul>
            </>
          ) : guesses.length > 0 ? (
            // Keyword search found nothing; show the AI best-guess fallback.
            <>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                No exact match. Our best guess:
              </p>
              <p className="mb-3 text-xs text-text-muted">
                Worked out by AI from the plot and what it knows about the show, so double-check it&apos;s right.
              </p>
              <ul className="space-y-3">
                {guesses.map((ep) => (
                  <ResultRow key={`g-${ep.seasonNumber}-${ep.episodeNumber}`} ep={ep} />
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-text-muted">
              No episodes matched &ldquo;{query}&rdquo;. Try a guest star, a name, or a word from the plot.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
