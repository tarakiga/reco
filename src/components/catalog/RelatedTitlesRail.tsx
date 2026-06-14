import { relatedTitles, type RelatedMediaType } from "@/services/related-titles";
import { Rail } from "./Rail";
import { TitleCard } from "./TitleCard";

/** Async server island (Suspense-streamed): Wikidata-sourced related titles. */
export async function RelatedTitlesRail({
  mediaType,
  tmdbId,
  title,
}: {
  mediaType: RelatedMediaType;
  tmdbId: number;
  title: string;
}) {
  const related = await relatedTitles(mediaType, tmdbId);
  if (related.length === 0) return null;
  return (
    <Rail title={title}>
      {related.map((r) => (
        <div key={`${r.mediaType}-${r.tmdbId}`} className="w-28 shrink-0">
          <TitleCard href={r.href} title={r.title} year={r.year} posterUrl={r.posterUrl} />
          <p className="mt-1 text-[11px] font-medium text-accent">{r.relation}</p>
        </div>
      ))}
    </Rail>
  );
}
