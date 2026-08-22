import { axesFor } from "@/lib/tmdb/axes";
import { axisGroup } from "@/services/title-axes";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import type { TitleResult } from "@/lib/tmdb/transform";
import { ChipRail, type ChipGroup } from "./ChipRail";

// A rail with fewer than 3 posters looks broken; hide the chip instead.
const MIN_GROUP = 3;

/** "You may also like": the curated TMDB recommendations as the default
 *  Top picks chip, plus axis chips whose membership is a verifiable shared
 *  fact (same maker, same lead, shared keyword, shared genre pair). */
export async function AlsoLikeSection({
  mediaType,
  tmdbId,
  meta,
  recs,
}: {
  mediaType: "movie" | "tv";
  tmdbId: number;
  meta: TmdbTitleDetail;
  recs: TitleResult[];
}) {
  const axes = axesFor(mediaType, meta);
  const groups = await Promise.all(axes.map((a) => axisGroup(mediaType, a, tmdbId)));

  const chips: ChipGroup[] = [
    ...(recs.length >= MIN_GROUP ? [{ label: "Top picks", items: recs }] : []),
    ...groups.filter((g) => g.items.length >= MIN_GROUP),
  ];
  if (chips.length === 0) return null;

  return (
    <ChipRail
      key={`${mediaType}-${tmdbId}`}
      title="You may also like"
      groups={chips}
      showSoloChip={chips[0].label !== "Top picks"}
    />
  );
}
