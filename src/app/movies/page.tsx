import { tmdb } from "@/lib/tmdb/client";
import { buildDiscoverParams, toBrowseResults } from "@/lib/tmdb/discover";
import { FilterBar } from "@/components/catalog/FilterBar";
import { TitleCard } from "@/components/catalog/TitleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { upcomingLabel } from "@/lib/release";
import { favouriteContext, favouriteProp } from "@/services/favourites";

export const metadata = {
  title: "Movies",
  description: "Browse and discover movies by genre and year.",
};

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; year?: string }>;
}) {
  const filters = await searchParams;
  const fav = await favouriteContext();
  let genres: { id: number; name: string }[] = [];
  let results: ReturnType<typeof toBrowseResults> = [];
  try {
    const [g, d] = await Promise.all([
      tmdb.genres("movie"),
      tmdb.discover("movie", buildDiscoverParams("movie", filters)),
    ]);
    genres = g.genres;
    results = toBrowseResults("movie", d.results);
  } catch {
    // TMDB error — render with empty results
  }
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Movies</h1>
      <div className="mb-6">
        <FilterBar action="/movies" genres={genres} selected={filters} />
      </div>
      {results.length === 0 ? (
        <EmptyState title="No movies found" description="Try different filters." />
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {results.map((t) => (
            <TitleCard key={t.tmdbId} href={t.href} title={t.title} year={t.year} posterUrl={t.posterUrl} upcoming={upcomingLabel(t.releaseDate)} favourite={favouriteProp(fav, "movie", t.tmdbId)} />
          ))}
        </div>
      )}
    </div>
  );
}
