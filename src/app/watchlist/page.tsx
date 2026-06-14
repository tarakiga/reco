import { connection } from "next/server";
import Link from "next/link";
import { getCurrentProfile } from "@/services/profile";
import { listWatchlist } from "@/services/user-catalog";
import { EmptyState } from "@/components/ui/EmptyState";
import { RegionSelect } from "@/components/catalog/RegionSelect";
import { WatchlistSections } from "@/components/account/WatchlistSections";

export const metadata = { title: "Your watchlist" };

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-text">Your watchlist</h1>
        <RegionSelect />
      </div>
      <WatchlistSections items={items} />
    </div>
  );
}
