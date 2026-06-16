import { Suspense } from "react";
import { type TitleResult, type PersonResult } from "@/lib/tmdb/transform";
import { searchWithCorrection } from "@/services/title-search";
import { TitleCard } from "@/components/catalog/TitleCard";
import { PersonCard } from "@/components/catalog/PersonCard";
import { upcomingLabel } from "@/lib/release";
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cardActionContext, favouriteProp, watchlistProp } from "@/services/favourites";
import { tvStatusBadges } from "@/services/tv-status";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();
  return { title: query ? `Search: ${query}` : "Search" };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <form action="/search" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <div className="flex-1">
          <Input name="q" label="Search" defaultValue={query} />
        </div>
        <Button type="submit" className="w-full sm:w-auto">Search</Button>
      </form>

      {!query ? (
        <p className="mt-8 text-center text-text-muted">
          Search for movies, TV shows, and people.
        </p>
      ) : (
        <Suspense key={query} fallback={<div className="mt-8"><PosterGridSkeleton /></div>}>
          <SearchResults query={query} />
        </Suspense>
      )}
    </div>
  );
}

async function SearchResults({ query }: { query: string }) {
  let results;
  let corrected: string | null = null;
  try {
    const outcome = await searchWithCorrection(query);
    results = outcome.results;
    corrected = outcome.corrected;
  } catch {
    return (
      <div className="mt-8">
        <EmptyState title="Search failed, try again" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState title={`No results for "${query}"`} />
      </div>
    );
  }

  const titles = results.filter((r): r is TitleResult => r.kind === "title");
  const people = results.filter((r): r is PersonResult => r.kind === "person");
  const ctx = await cardActionContext();
  const statuses = await tvStatusBadges(titles);

  return (
    <div className="mt-8 space-y-10">
      {corrected && (
        <p className="-mb-6 text-sm text-text-muted">
          No matches for &ldquo;{query}&rdquo; — showing results for{" "}
          <span className="font-medium text-text">{corrected}</span>
        </p>
      )}
      {titles.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text">Titles</h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {titles.map((t) => (
              <TitleCard
                key={t.tmdbId}
                href={t.href}
                title={t.title}
                year={t.year}
                posterUrl={t.posterUrl}
                upcoming={upcomingLabel(t.releaseDate)}
                status={statuses.get(t.tmdbId)}
                favourite={favouriteProp(ctx, t.mediaType, t.tmdbId)}
                watchlist={watchlistProp(ctx, t.mediaType, t.tmdbId)}
              />
            ))}
          </div>
        </section>
      )}
      {people.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text">People</h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {people.map((p) => (
              <PersonCard
                key={p.tmdbId}
                href={p.href}
                name={p.name}
                profileUrl={p.profileUrl}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
