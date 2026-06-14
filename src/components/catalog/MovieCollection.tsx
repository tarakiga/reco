import { collectionParts } from "@/services/collection";
import { Rail } from "./Rail";
import { TitleCard } from "./TitleCard";

/** Async server island: the rest of the TMDB collection this movie belongs to. */
export async function MovieCollection({
  movieId,
  collection,
}: {
  movieId: number;
  collection: { id: number; name: string } | null;
}) {
  if (!collection) return null;
  const parts = await collectionParts(collection.id, movieId);
  if (parts.length === 0) return null;
  return (
    <Rail title={collection.name}>
      {parts.map((p) => (
        <div key={p.tmdbId} className="w-28 shrink-0">
          <TitleCard href={p.href} title={p.title} year={p.year} posterUrl={p.posterUrl} />
        </div>
      ))}
    </Rail>
  );
}
