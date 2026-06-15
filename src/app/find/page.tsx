import { Suspense } from "react";
import { sceneSearch } from "@/services/scene-search";
import { parseMediaIntent } from "@/lib/scene/intent";
import { SceneSearchBar } from "@/components/search/SceneSearchBar";
import { SceneFilters } from "@/components/search/SceneFilters";
import { TitleCard } from "@/components/catalog/TitleCard";
import { MatchBadge } from "@/components/catalog/MatchBadge";
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";
import { cardActionContext, favouriteProp, watchlistProp } from "@/services/favourites";

type FindParams = { q?: string; type?: string };
type MediaOverride = "movie" | "tv" | "all" | undefined;

const asOverride = (type?: string): MediaOverride =>
  type === "movie" || type === "tv" || type === "all" ? type : undefined;

export async function generateMetadata({ searchParams }: { searchParams: Promise<FindParams> }) {
  const { q } = await searchParams;
  const query = q?.trim();
  return { title: query ? `Find: ${query}` : "Find a movie" };
}

export default async function FindPage({ searchParams }: { searchParams: Promise<FindParams> }) {
  const { q, type } = await searchParams;
  const query = q?.trim() ?? "";
  const override = asOverride(type);

  // Effective filter for the toggle highlight: explicit override, else auto-detected.
  const detected = parseMediaIntent(query).mediaType;
  const active = override === undefined ? detected : override === "all" ? null : override;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-text">Find a movie by memory</h1>
      <p className="mb-6 max-w-xl text-text-muted">
        Can&apos;t remember the name? Describe a scene or the plot and we&apos;ll find the closest matches.
      </p>
      <SceneSearchBar initialQuery={query} />
      {query ? (
        <>
          <SceneFilters query={query} active={active} />
          <Suspense key={`${query}|${override ?? "auto"}`} fallback={<div className="mt-8"><PosterGridSkeleton /></div>}>
            <SceneResults query={query} override={override} />
          </Suspense>
        </>
      ) : (
        <p className="mt-8 text-center text-text-muted">
          Try something like &ldquo;a giant squid attacks a cruise ship&rdquo;.
        </p>
      )}
    </div>
  );
}

async function SceneResults({ query, override }: { query: string; override: MediaOverride }) {
  const { results } = await sceneSearch(query, { limit: 24, override });
  const ctx = await cardActionContext();

  if (results.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          title="Nothing matched"
          description="Try describing it differently — more detail about the scene or plot usually helps."
        />
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
      {results.map((r) => (
        <div key={r.titleId} className="relative">
          <div className="absolute left-1.5 top-1.5 z-10">
            <MatchBadge match={r.match} />
          </div>
          <TitleCard href={r.href} title={r.title} year={r.year} posterUrl={r.posterUrl} favourite={favouriteProp(ctx, r.mediaType, r.tmdbId)} watchlist={watchlistProp(ctx, r.mediaType, r.tmdbId)} />
        </div>
      ))}
    </div>
  );
}
