import Link from "next/link";
import { tmdb } from "@/lib/tmdb/client";
import { toSearchResults } from "@/lib/tmdb/transform";
import { toBrowseResults } from "@/lib/tmdb/discover";
import type { TitleResult } from "@/lib/tmdb/transform";
import { TitleCard } from "@/components/catalog/TitleCard";
import { Rail } from "@/components/catalog/Rail";
import { ForYouPreview } from "@/components/home/ForYouPreview";
import { GenreTiles } from "@/components/home/GenreTiles";
import { SceneSearchBar } from "@/components/search/SceneSearchBar";

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
          Search and browse movies and TV shows, see where they&apos;re streaming, and keep track
          of what you want to watch.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
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

      {/* Shuffle call-to-action — prominent so impatient visitors can't miss it. */}
      <section className="mb-10">
        <div className="flex flex-col items-start gap-5 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/20 via-surface-raised to-surface-raised p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">Can&apos;t decide?</p>
            <h2 className="mt-1 text-2xl font-bold text-text sm:text-3xl">
              We&apos;ll find something you can watch right now
            </h2>
            <p className="mt-2 text-text-muted">
              Pick the streaming services you have and we&apos;ll instantly deal you a few great
              movies and shows everyone can actually agree on.
            </p>
          </div>
          <Link
            href="/shuffle"
            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-7 py-2.5 text-center text-base font-semibold leading-tight text-text shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
          >
            <span aria-hidden className="text-lg">🎲</span> Find me something to watch
          </Link>
        </div>
      </section>

      {/* "Describe a scene" CTA — find a film by what you remember. Warm amber to
          contrast with the red "Can't decide?" Shuffle card above. */}
      <section className="mb-10">
        <div className="rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/20 via-surface-raised to-surface-raised p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-warning">
            Can&apos;t remember the name?
          </p>
          <h2 className="mt-1 text-2xl font-bold text-text sm:text-3xl">Describe what you remember</h2>
          <p className="mb-4 mt-2 max-w-xl text-text-muted">
            Recall a scene but not the title? Describe it and we&apos;ll find the closest matches.
          </p>
          <SceneSearchBar />
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
