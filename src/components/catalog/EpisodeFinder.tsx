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
        {ep.matchedOn && (
          <span className="mt-1 inline-flex rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
            {ep.matchedOn}
          </span>
        )}
        {ep.overview && <p className="mt-1 line-clamp-2 text-sm text-text-muted">{ep.overview}</p>}
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
      return res.json() as Promise<{ results: EpisodeMatch[] }>;
    },
    enabled: query.length >= 2,
    staleTime: 60 * 60 * 1000,
  });
  const results = data?.results ?? [];

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
          ) : results.length === 0 ? (
            <p className="text-sm text-text-muted">
              No episodes matched &ldquo;{query}&rdquo;. Try a guest star, a name, or a word from the plot.
            </p>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}
