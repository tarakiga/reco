"use client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";

interface Genre { id: number; name: string }

export function OnboardingGenreStep({ selected, onToggle }: { selected: Set<number>; onToggle: (id: number) => void }) {
  const { data } = useQuery({
    queryKey: ["onboarding-genres"],
    queryFn: () => fetch("/api/v1/onboarding/genres").then((r) => r.json() as Promise<{ genres: Genre[] }>),
    staleTime: 60 * 60 * 1000,
  });
  const genres = data?.genres ?? [];
  return (
    <div className="flex flex-wrap gap-2.5">
      {genres.map((g) => {
        const on = selected.has(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onToggle(g.id)}
            aria-pressed={on}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              on ? "border-accent bg-accent text-white" : "border-border bg-surface-raised text-text hover:border-text-muted",
            )}
          >
            {g.name}
          </button>
        );
      })}
    </div>
  );
}
