import { tmdb } from "@/lib/tmdb/client";
import { buildDiscoverParams, toBrowseResults } from "@/lib/tmdb/discover";
import { FilterBar } from "@/components/catalog/FilterBar";
import { TitleCard } from "@/components/catalog/TitleCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "TV Shows — reco" };

export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; year?: string }>;
}) {
  const filters = await searchParams;
  let genres: { id: number; name: string }[] = [];
  let results: ReturnType<typeof toBrowseResults> = [];
  try {
    const [g, d] = await Promise.all([
      tmdb.genres("tv"),
      tmdb.discover("tv", buildDiscoverParams("tv", filters)),
    ]);
    genres = g.genres;
    results = toBrowseResults("tv", d.results);
  } catch {
    // TMDB error — render with empty results
  }
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">TV Shows</h1>
      <div className="mb-6">
        <FilterBar action="/tv" genres={genres} selected={filters} />
      </div>
      {results.length === 0 ? (
        <EmptyState title="No TV shows found" description="Try different filters." />
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {results.map((t) => (
            <TitleCard key={t.tmdbId} href={t.href} title={t.title} year={t.year} posterUrl={t.posterUrl} />
          ))}
        </div>
      )}
    </div>
  );
}
