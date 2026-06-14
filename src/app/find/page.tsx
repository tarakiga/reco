import { Suspense } from "react";
import { searchByScene } from "@/services/scene-search";
import { SceneSearchBar } from "@/components/search/SceneSearchBar";
import { TitleCard } from "@/components/catalog/TitleCard";
import { MatchBadge } from "@/components/catalog/MatchBadge";
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();
  return { title: query ? `Find: ${query}` : "Find a movie" };
}

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-text">Find a movie by memory</h1>
      <p className="mb-6 max-w-xl text-text-muted">
        Can&apos;t remember the name? Describe a scene or the plot and we&apos;ll find the closest matches.
      </p>
      <SceneSearchBar initialQuery={query} />
      {query ? (
        <Suspense key={query} fallback={<div className="mt-8"><PosterGridSkeleton /></div>}>
          <SceneResults query={query} />
        </Suspense>
      ) : (
        <p className="mt-8 text-center text-text-muted">
          Try something like &ldquo;a giant squid attacks a cruise ship&rdquo;.
        </p>
      )}
    </div>
  );
}

async function SceneResults({ query }: { query: string }) {
  const results = await searchByScene(query, { limit: 24 });

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
          <TitleCard href={r.href} title={r.title} year={r.year} posterUrl={r.posterUrl} />
        </div>
      ))}
    </div>
  );
}
