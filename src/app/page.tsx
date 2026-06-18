import { Suspense } from "react";
import Link from "next/link";
import { tmdb } from "@/lib/tmdb/client";
import { toSearchResults } from "@/lib/tmdb/transform";
import { toBrowseResults } from "@/lib/tmdb/discover";
import { backdropUrl, posterUrl } from "@/lib/tmdb/images";
import { cacheLife } from "next/cache";
import { titleSlug } from "@/lib/slug";
import type { TitleResult } from "@/lib/tmdb/transform";
import { TitleCard } from "@/components/catalog/TitleCard";
import { Rail } from "@/components/catalog/Rail";
import { ForYouPreview } from "@/components/home/ForYouPreview";
import { GenreTiles } from "@/components/home/GenreTiles";
import { MoodRails } from "@/components/home/MoodRails";
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

async function getNowPlaying(): Promise<TitleResult[]> {
  "use cache";
  try {
    const data = await tmdb.nowPlaying();
    return toBrowseResults("movie", data.results);
  } catch {
    return [];
  }
}

/** The current #1 in cinemas, as the home hero background. */
async function getBoxOfficeHero(): Promise<{ title: string; image: string; href: string } | null> {
  "use cache";
  cacheLife("hours");
  try {
    const data = await tmdb.nowPlaying();
    // Rank in-cinema titles by popularity (TMDB's box-office proxy) and drop
    // adult titles, so we pick the genuine #1 rather than trusting list order.
    const top = (data.results ?? [])
      .filter((r) => !r.adult)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];
    if (!top) return null;
    // Always show the actual leader. Prefer a wide backdrop; if it has none,
    // fall back to its own poster so the image and the "#1" credit never
    // disagree. We never substitute a lower-ranked film just to get a backdrop.
    const image = backdropUrl(top.backdrop_path) ?? posterUrl(top.poster_path);
    if (!image) return null;
    const name = top.title ?? top.name ?? "Untitled";
    const date = top.release_date ?? top.first_air_date ?? null;
    return { title: name, image, href: `/title/movie/${top.id}-${titleSlug(name, date)}` };
  } catch {
    return null;
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
  const [trending, nowPlaying, popularMovies, popularTv, hero] = await Promise.all([
    getTrending(),
    getNowPlaying(),
    getPopular("movie"),
    getPopular("tv"),
    getBoxOfficeHero(),
  ]);

  return (
    <div>
      {hero ? (
        <section
          className="relative -mt-8 mb-10 mx-[calc(50%-50vw)] flex min-h-[calc(100svh-4rem)] w-screen flex-col items-center justify-center overflow-hidden bg-cover bg-center bg-fixed px-4 py-16 text-center"
          style={{ backgroundImage: `url(${hero.image})` }}
        >
          {/* Contrast overlay (whole hero) + top darkening (nav readability). */}
          <div className="pointer-events-none absolute inset-0 bg-black/55" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
          {/* Bottom fade to the page background so the edge isn't a sharp line. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-surface" />

          <div className="relative z-10 flex flex-col items-center">
            <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl">Find what to watch.</h1>
            <p className="mx-auto mt-4 max-w-xl text-white/85 drop-shadow">
              Search and browse movies and TV shows, see where they&apos;re streaming, and keep track
              of what you want to watch.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/movies" className="inline-flex h-10 items-center justify-center rounded-md border border-white/20 bg-black/40 px-5 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                Browse movies
              </Link>
              <Link href="/tv" className="inline-flex h-10 items-center justify-center rounded-md border border-white/20 bg-black/40 px-5 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                Browse TV
              </Link>
            </div>
            <p className="mt-5 text-sm text-white/85">
              New here?{" "}
              <Link href="/what-can-i-do" className="font-medium text-white underline underline-offset-2 hover:text-accent">
                See everything you can do →
              </Link>
            </p>
          </div>

          {/* Featured: the current #1 in cinemas, credited bottom-left like a marquee. */}
          <Link
            href={hero.href}
            className="group absolute bottom-12 left-5 z-10 max-w-[85%] text-left sm:bottom-16 sm:left-10"
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent drop-shadow sm:text-xs">
              <span className="inline-block h-px w-6 bg-accent" aria-hidden /> Now #1 in cinemas
            </span>
            <span className="mt-1.5 block text-3xl font-bold leading-none text-white drop-shadow-lg transition-colors group-hover:text-accent sm:text-5xl">
              {hero.title}
            </span>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-white/75 transition-colors group-hover:text-white">
              View details
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </Link>
        </section>
      ) : (
        <section className="py-12 text-center sm:py-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Find what to watch.</h1>
          <p className="mx-auto mt-4 max-w-xl text-text-muted">
            Search and browse movies and TV shows, see where they&apos;re streaming, and keep track
            of what you want to watch.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/movies" className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface-raised px-5 text-sm font-medium text-text transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Browse movies
            </Link>
            <Link href="/tv" className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface-raised px-5 text-sm font-medium text-text transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Browse TV
            </Link>
          </div>
          <p className="mt-5 text-sm text-text-muted">
            New here?{" "}
            <Link href="/what-can-i-do" className="font-medium text-accent hover:underline">
              See everything you can do →
            </Link>
          </p>
        </section>
      )}

      {/* Two compact CTAs, side by side on desktop and equal height. Red Shuffle
          + amber "describe a scene". */}
      <section className="mb-10 grid gap-4 md:grid-cols-2">
        <div className="flex h-full flex-col rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/20 via-surface-raised to-surface-raised p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Can&apos;t decide?</p>
          <h2 className="mt-1 text-xl font-bold text-text">We&apos;ll pick something you can watch now</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            Choose your streaming services and we&apos;ll deal a few picks everyone agrees on.
          </p>
          <div className="mt-auto pt-4">
            <Link
              href="/shuffle"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-text shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span aria-hidden>🎲</span> Find me something
            </Link>
          </div>
        </div>

        <div className="flex h-full flex-col rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/20 via-surface-raised to-surface-raised p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">Can&apos;t remember the name?</p>
          <h2 className="mt-1 text-xl font-bold text-text">Describe what you remember</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            Recall a scene but not the title? Describe it and we&apos;ll find the closest matches.
          </p>
          <div className="mt-auto pt-4">
            <SceneSearchBar />
          </div>
        </div>
      </section>

      <ForYouPreview />

      {trending.length > 0 ? (
        <PosterRail title="Trending this week" items={trending} />
      ) : (
        <p className="text-center text-text-muted">Trending titles unavailable right now.</p>
      )}

      <PosterRail title="In cinemas this week" items={nowPlaying} />

      {/* Release calendar CTA — teal, to stand apart from the red Shuffle and
          amber "describe a scene" cards above. */}
      <section className="mb-10">
        <div className="flex flex-col gap-5 rounded-2xl border border-success/30 bg-gradient-to-br from-success/15 via-surface-raised to-surface-raised p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-4">
            <span aria-hidden className="hidden text-4xl leading-none sm:block">📅</span>
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-success">
                Coming soon to a screen near you
              </p>
              <h2 className="mt-1 text-2xl font-bold text-text sm:text-3xl">What&apos;s coming out</h2>
              <p className="mt-2 text-text-muted">
                Browse the next two months of cinema and streaming releases, and catch what just
                landed on your subscriptions.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 sm:items-end">
            <Link
              href="/calendar"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-surface shadow-lg shadow-success/20 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success sm:w-auto"
            >
              Open Calendar
            </Link>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <MoodRails />
      </Suspense>

      <PosterRail title="Popular movies" items={popularMovies} />
      <PosterRail title="Popular TV shows" items={popularTv} />

      <GenreTiles />
    </div>
  );
}
