import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMoodBySlug } from "@/lib/moods";
import { getMoodTitles } from "@/services/moods";
import { cardActionContext, favouriteProp, watchlistProp } from "@/services/favourites";
import { TitleCard } from "@/components/catalog/TitleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { upcomingLabel } from "@/lib/release";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mood = getMoodBySlug(slug);
  return mood ? { title: `${mood.label} — movies to watch`, description: mood.blurb } : {};
}

export default async function MoodPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const mood = getMoodBySlug(slug);
  if (!mood) notFound();

  const [items, ctx] = await Promise.all([getMoodTitles(slug, 3), cardActionContext()]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/moods" className="text-sm font-medium text-accent-text hover:underline">
          ← All moods
        </Link>
        <h1 className="text-2xl font-bold text-text">
          <span aria-hidden className="mr-2">{mood.emoji}</span>
          {mood.label}
        </h1>
        <p className="text-sm text-text-muted">{mood.blurb}</p>
      </header>

      {items.length === 0 ? (
        <EmptyState title="Nothing to show" description="No titles matched this mood right now." />
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {items.map((t) => (
            <TitleCard
              key={t.tmdbId}
              href={t.href}
              title={t.title}
              year={t.year}
              posterUrl={t.posterUrl}
              upcoming={upcomingLabel(t.releaseDate)}
              favourite={favouriteProp(ctx, t.mediaType, t.tmdbId)}
              watchlist={watchlistProp(ctx, t.mediaType, t.tmdbId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
