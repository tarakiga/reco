import Link from "next/link";
import { tmdb } from "@/lib/tmdb/client";

async function getGenres(): Promise<{ id: number; name: string }[]> {
  "use cache";
  try {
    const { genres } = await tmdb.genres("movie");
    return genres;
  } catch {
    return [];
  }
}

/** Browse-by-genre tiles linking into the movies catalog. */
export async function GenreTiles() {
  const genres = await getGenres();
  if (genres.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-text">Browse by genre</h2>
      <div className="flex flex-wrap gap-2">
        {genres.map((g) => (
          <Link
            key={g.id}
            href={`/movies?genre=${g.id}`}
            className="inline-flex h-9 items-center rounded-full border border-border bg-surface-raised px-4 text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent"
          >
            {g.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
