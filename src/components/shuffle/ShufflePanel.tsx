"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { meFetch } from "@/lib/me-client";
import { ServicePicker } from "./ServicePicker";
import { ShuffleControls, type MediaType } from "./ShuffleControls";
import { ShuffleResults } from "./ShuffleResults";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ShufflePick } from "@/services/shuffle";

interface ShuffleResponse { picks: ShufflePick[]; broaden: boolean }

export function ShufflePanel() {
  const { isSignedIn } = useAuth();
  const { data: region = "US" } = useQuery({
    queryKey: ["me-region"],
    enabled: isSignedIn === true,
    queryFn: () => meFetch<{ region?: string }>("/api/v1/me/profile").then((r) => r.region ?? "US").catch(() => "US"),
    staleTime: 5 * 60 * 1000,
  });

  const [services, setServices] = useState<number[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>("any");
  const [genres, setGenres] = useState<number[]>([]);
  const [matchTaste, setMatchTaste] = useState(false);

  const run = useMutation({
    mutationFn: () => {
      const qs = new URLSearchParams({ type: mediaType });
      if (services.length) qs.set("services", services.join(","));
      if (genres.length) qs.set("genres", genres.join(","));
      if (matchTaste) qs.set("matchTaste", "1");
      return fetch(`/api/v1/shuffle?${qs.toString()}`).then((r) => r.json() as Promise<ShuffleResponse>);
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-text sm:text-3xl">Can&apos;t decide? Shuffle.</h1>
      <p className="mt-1 text-sm text-text-muted">Pick the services you have and we&apos;ll deal a few options everyone can actually watch.</p>

      <div className="mt-6 flex flex-col gap-5 rounded-lg border border-border bg-surface-raised/40 p-4">
        <ServicePicker region={region} selected={services} onChange={setServices} />
        <ShuffleControls
          mediaType={mediaType} onMediaType={setMediaType}
          genres={genres} onGenres={setGenres}
          matchTaste={matchTaste} onMatchTaste={setMatchTaste} canMatchTaste={isSignedIn === true}
          onShuffle={() => run.mutate()} loading={run.isPending}
        />
      </div>

      <div className="mt-8">
        {run.isPending && <p className="text-center text-text-muted">Shuffling…</p>}
        {run.data && run.data.picks.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-text">{run.data.picks.length} picks for tonight</div>
              <button type="button" onClick={() => run.mutate()} className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs text-text-muted hover:text-text">↻ Shuffle again</button>
            </div>
            <ShuffleResults picks={run.data.picks} />
            {run.data.broaden && (
              <p className="mt-4 text-center text-sm text-text-muted">Slim pickings — try adding a service or removing a genre.</p>
            )}
          </>
        )}
        {run.data && run.data.picks.length === 0 && (
          <EmptyState title="Nothing matched those filters" description="Add a streaming service or loosen the genres and shuffle again." />
        )}
      </div>
    </div>
  );
}
