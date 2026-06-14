import Link from "next/link";
import { tmdb } from "@/lib/tmdb/client";
import { toSearchResults } from "@/lib/tmdb/transform";
import { toBrowseResults } from "@/lib/tmdb/discover";
import type { TitleResult } from "@/lib/tmdb/transform";
import { TitleCard } from "@/components/catalog/TitleCard";
import { Rail } from "@/components/catalog/Rail";
import { ForYouPreview } from "@/components/home/ForYouPreview";
import { GenreTiles } from "@/components/home/GenreTiles";

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

async function getPopular(mediaType: "movie" | "tv"): Promise<TitleResult[]> {
  "use cache";
  try {
    const data = await tmdb.popular(mediaType);
    return toBrowseResults(mediaType, data.results);
  } catch {
    return [];
  }
}

function PosterRail({ title, items }: { title: string; items: TitleResult[] }) {
  if (items.length === 0) return null;
  return (
    <Rail title={title}>
      {items.map((item) => (
        <div key={item.tmdbId} className="w-32 shrink-0">
          <TitleCard href={item.href} title={item.title} year={item.year} posterUrl={item.posterUrl} />
        </div>
      ))}
    </Rail>
  );
}

export default async function Home() {
  const [trending, popularMovies, popularTv] = await Promise.all([
    getTrending(),
    getPopular("movie"),
    getPopular("tv"),
  ]);

  return (
    <div>
      <section className="py-12 text-center sm:py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Find what to watch.</h1>
        <p className="mx-auto mt-4 max-w-xl text-text-muted">
          Search, browse, and get picks tuned to your taste — or when you just can&apos;t decide,
          let Shuffle deal you a few great options.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/shuffle"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-text transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span aria-hidden>🎲</span> Shuffle
          </Link>
          <Link
            href="/movies"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface-raised px-5 text-sm font-medium text-text transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

      <ForYouPreview />

      {trending.length > 0 ? (
        <PosterRail title="Trending this week" items={trending} />
      ) : (
        <p className="text-center text-text-muted">Trending titles unavailable right now.</p>
      )}

      <PosterRail title="Popular movies" items={popularMovies} />
      <PosterRail title="Popular TV shows" items={popularTv} />

      <GenreTiles />
    </div>
  );
}
