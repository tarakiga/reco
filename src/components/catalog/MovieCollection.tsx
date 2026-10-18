import { collectionItems } from "@/services/completion";
import { Rail } from "./Rail";
import { TitleCard } from "./TitleCard";
import { CollectionWatched, SeenBadge } from "./CollectionWatched";

/** Async server island: the rest of the TMDB collection this movie belongs to.
 *  The same for every visitor; the signed-in watched count and "Seen" badges
 *  are filled in by the browser. */
export async function MovieCollection({
  movieId,
  collection,
}: {
  movieId: number;
  collection: { id: number; name: string } | null;
}) {
  if (!collection) return null;
  const items = await collectionItems(collection.id);
  const others = items.filter((p) => p.tmdbId !== movieId);
  if (others.length === 0) return null;

  return (
    <Rail title={collection.name} action={<CollectionWatched keys={items.map((p) => p.key)} />}>
      {others.map((p) => (
        <div key={p.tmdbId} className="relative w-28 shrink-0">
          <TitleCard href={p.href} title={p.title} year={p.year} posterUrl={p.posterUrl} />
          <SeenBadge itemKey={p.key} />
        </div>
      ))}
    </Rail>
  );
}
