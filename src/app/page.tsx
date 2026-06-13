import { tmdb } from "@/lib/tmdb/client";
import { toSearchResults } from "@/lib/tmdb/transform";
import type { TitleResult } from "@/lib/tmdb/transform";
import { TitleCard } from "@/components/catalog/TitleCard";
import { Rail } from "@/components/catalog/Rail";

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

export default async function Home() {
  const trending = await getTrending();
  return (
    <div>
      <section className="py-10 text-center">
        <h1 className="text-4xl font-bold">Find what to watch.</h1>
        <p className="mt-3 text-text-muted">
          Movies and TV shows — search, discover, track.
        </p>
      </section>
      {trending.length > 0 ? (
        <Rail title="Trending this week">
          {trending.map((item) => (
            <div key={item.tmdbId} className="w-32 shrink-0">
              <TitleCard
                href={item.href}
                title={item.title}
                year={item.year}
                posterUrl={item.posterUrl}
              />
            </div>
          ))}
        </Rail>
      ) : (
        <p className="text-center text-text-muted">Trending titles unavailable right now.</p>
      )}
    </div>
  );
}
