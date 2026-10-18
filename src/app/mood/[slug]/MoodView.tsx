import Link from "next/link";
import { hasTvTab, moodBlurb, type Mood, type MoodMedia } from "@/lib/moods";
import { getMoodTitles } from "@/services/moods";
import { cardTarget } from "@/lib/favourite";
import { TitleCard } from "@/components/catalog/TitleCard";
import { MoodTabs } from "@/components/catalog/MoodTabs";
import { EmptyState } from "@/components/ui/EmptyState";

export async function MoodView({ mood, media }: { mood: Mood; media: MoodMedia }) {
  const items = await getMoodTitles(mood.slug, media, 3);

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
        <p className="text-sm text-text-muted">{moodBlurb(mood, media)}</p>
      </header>

      {hasTvTab(mood) && <MoodTabs slug={mood.slug} active={media} />}

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
              releaseDate={t.releaseDate}
              favourite={cardTarget(t.mediaType, t.tmdbId)}
              watchlist={cardTarget(t.mediaType, t.tmdbId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
