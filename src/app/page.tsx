import Link from "next/link";
import { tmdb } from "@/lib/tmdb/client";
import { toSearchResults } from "@/lib/tmdb/transform";
import type { TitleResult } from "@/lib/tmdb/transform";
import { TitleCard } from "@/components/catalog/TitleCard";
import { Rail } from "@/components/catalog/Rail";

async function getTrending(): Promise<TitleResult[]> {
  "use cache";
  try {
    const data = await tmdb.trending();
    const results = toSearchResults(data.results);
    return results.filter((r): r is TitleResult => r.kind === "title");
  } catch {
    return [];
  }
}

export default async function Home() {
  const trending = await getTrending();
  return (
    <div>
      <section className="py-12 text-center sm:py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Find what to watch.</h1>
        <p className="mx-auto mt-4 max-w-xl text-text-muted">
          Search movies and TV shows, see where they&apos;re streaming, and keep track of
          what you want to watch.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/movies"
            className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-text transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Browse movies
          </Link>
          <Link
            href="/tv"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface-raised px-5 text-sm font-medium text-text transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Browse TV
          </Link>
        </div>
      </section>
      {trending.length > 0 ? (
        <Rail title="Trending this week">
          {trending.map((item) => (
            <div key={item.tmdbId} className="w-32 shrink-0">
              <TitleCard
                href={item.href}
                title={item.title}
                year={item.year}
                posterUrl={item.posterUrl}
              />
            </div>
          ))}
        </Rail>
      ) : (
        <p className="text-center text-text-muted">Trending titles unavailable right now.</p>
      )}
    </div>
  );
}
