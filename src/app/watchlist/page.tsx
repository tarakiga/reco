import { connection } from "next/server";
import Link from "next/link";
import { getCurrentProfile } from "@/services/profile";
import { listWatchlist, type WatchStatus } from "@/services/user-catalog";
import { posterUrl } from "@/lib/tmdb/images";
import { TitleCard } from "@/components/catalog/TitleCard";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata() {
  return { title: "Your watchlist — reco" };
}

const STATUS_GROUPS: { status: WatchStatus; label: string }[] = [
  { status: "watching", label: "Watching" },
  { status: "want_to_watch", label: "Want to watch" },
  { status: "watched", label: "Watched" },
];

export default async function WatchlistPage() {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EmptyState
          title="Sign in to see your watchlist"
          description="Track what you want to watch, are watching, and have watched."
          action={
            <Link
              href="/sign-in"
              className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-text transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  const items = await listWatchlist(profile.id);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="mb-8 text-2xl font-bold text-text">Your watchlist</h1>
        <EmptyState
          title="Your watchlist is empty"
          description="Find something to watch and add it here."
          action={
            <Link
              href="/movies"
              className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-text transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Browse movies
            </Link>
          }
        />
      </div>
    );
  }

  const grouped = new Map<WatchStatus, typeof items>();
  for (const item of items) {
    const bucket = grouped.get(item.status) ?? [];
    bucket.push(item);
    grouped.set(item.status, bucket);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-text">Your watchlist</h1>
      <div className="space-y-10">
        {STATUS_GROUPS.map(({ status, label }) => {
          const group = grouped.get(status);
          if (!group || group.length === 0) return null;
          return (
            <section key={status}>
              <h2 className="mb-4 text-lg font-semibold text-text">{label}</h2>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
                {group.map((item) => (
                  <TitleCard
                    key={item.titleId}
                    href={`/title/${item.mediaType}/${item.tmdbId}-${item.slug}`}
                    title={item.title}
                    year={item.releaseYear}
                    posterUrl={posterUrl(item.posterPath)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
