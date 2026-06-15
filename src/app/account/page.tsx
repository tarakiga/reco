import { connection } from "next/server";
import Link from "next/link";
import { getCurrentProfile } from "@/services/profile";
import { listWatchlist, listFavourites } from "@/services/user-catalog";
import { getEpg } from "@/services/epg";
import { posterUrl } from "@/lib/tmdb/images";
import { SITE_URL } from "@/lib/brand";
import { EmptyState } from "@/components/ui/EmptyState";
import { AccountHeader } from "@/components/account/AccountHeader";
import { AccountSettings } from "@/components/account/AccountSettings";
import { WatchlistSections } from "@/components/account/WatchlistSections";
import { FavouritesGrid, type FavouriteVM } from "@/components/account/FavouritesGrid";
import { UpcomingEpg } from "@/components/account/UpcomingEpg";

export const metadata = { title: "Your account" };

export default async function AccountPage() {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EmptyState
          title="Sign in to view your account"
          description="Manage your profile, watchlist, and favourites in one place."
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

  const [watchlist, favourites, epg] = await Promise.all([
    listWatchlist(profile.id),
    listFavourites(profile.id),
    getEpg(profile.id),
  ]);

  // Private calendar feed — the profile UUID is the unguessable token.
  const feedPath = `/api/calendar/${profile.id}.ics`;
  const icsUrl = `${SITE_URL}${feedPath}`;
  const webcalUrl = `webcal://${SITE_URL.replace(/^https?:\/\//, "")}${feedPath}`;
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  const favouriteVMs: FavouriteVM[] = favourites.map((f) => ({
    titleId: f.titleId,
    tmdbId: f.tmdbId,
    mediaType: f.mediaType,
    href: `/title/${f.mediaType}/${f.tmdbId}-${f.slug}`,
    title: f.title,
    year: f.releaseYear,
    posterUrl: posterUrl(f.posterPath),
  }));

  const memberSince = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
    profile.createdAt,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-8">
      <AccountHeader username={profile.username} memberSince={memberSince} />

      <section>
        <UpcomingEpg entries={epg} icsUrl={icsUrl} webcalUrl={webcalUrl} googleUrl={googleUrl} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-text">Settings</h2>
        <AccountSettings
          initialRegion={profile.region}
          initialGenres={profile.preferredGenres ?? []}
        />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-text">Favourites</h2>
        <FavouritesGrid initial={favouriteVMs} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-text">Your watchlist</h2>
        {watchlist.length === 0 ? (
          <EmptyState
            title="Your watchlist is empty"
            description="Add movies and shows you want to track and they'll show up here."
            action={
              <Link
                href="/movies"
                className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-text transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Browse movies
              </Link>
            }
          />
        ) : (
          <WatchlistSections items={watchlist} />
        )}
      </section>
    </div>
  );
}
