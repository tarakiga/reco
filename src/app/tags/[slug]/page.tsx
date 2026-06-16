import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/services/profile";
import { getTagCollection } from "@/services/tags";
import { cardActionContext, favouriteProp, watchlistProp } from "@/services/favourites";
import { tvStatusBadges } from "@/services/tv-status";
import { TitleCard } from "@/components/catalog/TitleCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Tag" };

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EmptyState
          title="Sign in to view your tags"
          description="Tags are your private organizational layer."
          action={
            <Link
              href="/sign-in"
              className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-text transition-colors hover:bg-accent-hover"
            >
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  const collection = await getTagCollection(profile.id, slug);
  if (!collection) notFound();

  const ctx = await cardActionContext();
  const statuses = await tvStatusBadges(collection.items);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm font-medium uppercase tracking-wide text-text-muted">Your tag</p>
      <h1 className="mb-6 text-2xl font-bold text-text sm:text-3xl">#{collection.name}</h1>
      {collection.items.length === 0 ? (
        <EmptyState title="Nothing tagged yet" description="Tag titles from their detail page and they'll collect here." />
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {collection.items.map((it) => (
            <TitleCard
              key={`${it.mediaType}-${it.tmdbId}`}
              href={it.href}
              title={it.title}
              year={it.year}
              posterUrl={it.posterUrl}
              status={statuses.get(it.tmdbId)}
              favourite={favouriteProp(ctx, it.mediaType, it.tmdbId)}
              watchlist={watchlistProp(ctx, it.mediaType, it.tmdbId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
