"use client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";

export type MediaType = "any" | "movie" | "tv";
interface Genre { id: number; name: string }

export function ShuffleControls({
  mediaType, onMediaType, genres, onGenres, matchTaste, onMatchTaste, canMatchTaste, onShuffle, loading,
}: {
  mediaType: MediaType; onMediaType: (m: MediaType) => void;
  genres: number[]; onGenres: (g: number[]) => void;
  matchTaste: boolean; onMatchTaste: (v: boolean) => void; canMatchTaste: boolean;
  onShuffle: () => void; loading: boolean;
}) {
  const { data } = useQuery({
    queryKey: ["onboarding-genres"],
    queryFn: () => fetch("/api/v1/onboarding/genres").then((r) => r.json() as Promise<{ genres: Genre[] }>),
    staleTime: 60 * 60 * 1000,
  });
  const genreList = data?.genres ?? [];

  const types: { v: MediaType; label: string }[] = [
    { v: "any", label: "Surprise me" }, { v: "movie", label: "Movies" }, { v: "tv", label: "TV" },
  ];

  function toggleGenre(id: number) {
    onGenres(genres.includes(id) ? genres.filter((g) => g !== id) : [...genres, id]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex rounded-md border border-border bg-surface-raised p-0.5">
          {types.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => onMediaType(t.v)}
              className={cn("rounded px-3 py-1.5 text-sm transition", mediaType === t.v ? "bg-accent text-white" : "text-text-muted hover:text-text")}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canMatchTaste && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={matchTaste} onChange={(e) => onMatchTaste(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
            Match my taste
          </label>
        )}
        <button
          type="button"
          onClick={onShuffle}
          disabled={loading}
          className="ml-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? "Shuffling…" : "🎲 Shuffle"}
        </button>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-text-muted">Genres {genres.length > 0 && `(${genres.length})`}</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {genreList.map((g) => {
            const on = genres.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGenre(g.id)}
                aria-pressed={on}
                className={cn("rounded-full border px-3 py-1 text-xs transition", on ? "border-accent bg-accent text-white" : "border-border bg-surface-raised text-text hover:border-text-muted")}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}
