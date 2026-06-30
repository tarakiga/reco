import { connection } from "next/server";
import Link from "next/link";
import { Rail } from "@/components/catalog/Rail";
import { TitleCard } from "@/components/catalog/TitleCard";
import { cardActionContext, favouriteProp, watchlistProp } from "@/services/favourites";
import { getMoodTitles } from "@/services/moods";
import { featuredMoods } from "@/lib/moods";

/**
 * Home-page mood rails — two pinned moods plus seasonal/rotating slots. Dynamic
 * (resolves the current date + signed-in user for card quick-actions), so render
 * it inside a <Suspense> boundary on the otherwise-static home page.
 */
export async function MoodRails() {
  await connection(); // dynamic: reads the current date + signed-in user
  const now = new Date();
  const month = now.getMonth() + 1;
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - startOfYear) / 86_400_000,
  );
  const moods = featuredMoods(month, dayOfYear);

  const [ctx, ...lists] = await Promise.all([
    cardActionContext(),
    ...moods.map((m) => getMoodTitles(m.slug)),
  ]);

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
                favourite={favouriteProp(ctx, t.mediaType, t.tmdbId)}
                watchlist={watchlistProp(ctx, t.mediaType, t.tmdbId)}
              />
            </div>
          ))}
        </Rail>
      ))}
    </section>
  );
}
