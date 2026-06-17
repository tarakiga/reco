import { getCurrentProfile } from "@/services/profile";
import { collectionItems, watchedTitleKeys } from "@/services/completion";
import { Rail } from "./Rail";
import { TitleCard } from "./TitleCard";

/** Async server island: the rest of the TMDB collection this movie belongs to,
 *  with per-user watched progress when signed in. */
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

  const profile = await getCurrentProfile();
  const watched = profile ? await watchedTitleKeys(profile.id) : new Set<string>();
  const watchedCount = items.filter((p) => watched.has(p.key)).length;

  return (
    <Rail
      title={collection.name}
      action={
        profile ? (
          <span className="text-xs text-text-muted">
            {watchedCount}/{items.length} watched
          </span>
        ) : undefined
      }
    >
      {others.map((p) => (
        <div key={p.tmdbId} className="relative w-28 shrink-0">
          <TitleCard href={p.href} title={p.title} year={p.year} posterUrl={p.posterUrl} />
          {watched.has(p.key) && (
            <span className="absolute left-1 top-1 rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-surface">
              Seen
            </span>
          )}
        </div>
      ))}
    </Rail>
  );
}
