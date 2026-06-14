import { relatedShows } from "@/services/related-shows";
import { Rail } from "./Rail";
import { TitleCard } from "./TitleCard";

/** Async server island (Suspense-streamed): spin-offs / remakes / franchise mates. */
export async function RelatedShows({ tvId }: { tvId: number }) {
  const related = await relatedShows(tvId);
  if (related.length === 0) return null;
  return (
    <Rail title="Spinoffs & related">
      {related.map((r) => (
        <div key={r.tmdbId} className="w-28 shrink-0">
          <TitleCard href={r.href} title={r.title} year={r.year} posterUrl={r.posterUrl} />
          <p className="mt-1 text-[11px] font-medium text-accent">{r.relation}</p>
        </div>
      ))}
    </Rail>
  );
}
