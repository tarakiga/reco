import Link from "next/link";
import { Rail } from "@/components/catalog/Rail";
import { TitleCard } from "@/components/catalog/TitleCard";
import { cardTarget } from "@/lib/favourite";
import { getMoodTitles } from "@/services/moods";
import { featuredMoods } from "@/lib/moods";
import { cachedTodayYmd } from "@/services/clock";

/**
 * Home-page mood rails: two pinned moods plus seasonal/rotating slots. The
 * rotation follows the cached server date, so it can lag by up to an hour and
 * the page stays fully static.
 */
export async function MoodRails() {
  const [year, month, day] = (await cachedTodayYmd()).split("-").map(Number);
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000);
  const moods = featuredMoods(month, dayOfYear);

  const lists = await Promise.all(moods.map((m) => getMoodTitles(m.slug)));

  const rails = moods
    .map((m, i) => ({ mood: m, items: lists[i] ?? [] }))
    .filter((r) => r.items.length > 0);
  if (rails.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-text">Browse by mood</h2>
        <Link
          href="/moods"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-text shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          All moods →
        </Link>
      </div>
      {rails.map(({ mood, items }) => (
        <Rail
          key={mood.slug}
          title={`${mood.emoji} ${mood.label}`}
          action={
            <Link href={`/mood/${mood.slug}`} className="text-sm font-medium text-accent-text hover:underline">
              See all →
            </Link>
          }
        >
          {items.slice(0, 18).map((t) => (
            <div key={t.tmdbId} className="w-32 shrink-0">
              <TitleCard
                href={t.href}
                title={t.title}
                year={t.year}
                posterUrl={t.posterUrl}
                favourite={cardTarget(t.mediaType, t.tmdbId)}
                watchlist={cardTarget(t.mediaType, t.tmdbId)}
              />
            </div>
          ))}
        </Rail>
      ))}
    </section>
  );
}
