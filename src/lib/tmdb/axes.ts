import type { TmdbTitleDetail } from "./types";

/** One reason-to-recommend, derived from a fact the source title shares with
 *  every member of its group, so the label is true by construction. */
export type TitleAxis =
  | { kind: "person"; personId: number; label: string }
  | { kind: "cast"; personId: number; label: string }
  | { kind: "keyword"; keywordId: number; label: string }
  | { kind: "genre"; genreIds: [number, number]; label: string };

/** TMDB keywords too structural or generic to make a meaningful group. */
const KEYWORD_STOPLIST = new Set([
  "aftercreditsstinger",
  "duringcreditsstinger",
  "based on novel or book",
  "based on comic",
  "based on true story",
  "based on a true story",
  "woman director",
  "sequel",
  "remake",
  "short film",
  "anthology",
]);

/** Up to 4 axes (one per kind) read from the already-fetched detail payload.
 *  Pure; anything missing (no crew, no keywords, one genre) just skips its axis. */
export function axesFor(mediaType: "movie" | "tv", meta: TmdbTitleDetail): TitleAxis[] {
  const out: TitleAxis[] = [];

  const maker =
    mediaType === "tv"
      ? meta.created_by?.[0]
      : meta.credits?.crew?.find((c) => c.job === "Director");
  if (maker) {
    out.push({
      kind: "person",
      personId: maker.id,
      label: `More from ${maker.name}`,
    });
  }

  // credits.cast is the current-season cast for TV (the page's Cast rail uses
  // aggregate credits instead); the first-billed current lead is acceptable here.
  const lead = [...(meta.credits?.cast ?? [])].sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999),
  )[0];
  // Skip the cast axis when the lead is also the maker, so we do not show
  // "More from X" and "Also starring X" as duplicate chips for the same person.
  if (lead && lead.id !== maker?.id) {
    out.push({ kind: "cast", personId: lead.id, label: `Also starring ${lead.name}` });
  }

  // TMDB quirk: movies nest keywords under .keywords, TV under .results.
  const keywords = mediaType === "tv" ? meta.keywords?.results : meta.keywords?.keywords;
  const keyword = (keywords ?? []).find(
    (k) => k.name && !KEYWORD_STOPLIST.has(k.name.toLowerCase()),
  );
  if (keyword) {
    out.push({ kind: "keyword", keywordId: keyword.id, label: `More ${keyword.name.toLowerCase()}` });
  }

  const genres = meta.genres ?? [];
  if (genres.length >= 2) {
    // Sort the pair by id so [Action, Comedy] and [Comedy, Action] share one axis.
    const [a, b] = [genres[0], genres[1]].sort((x, y) => x.id - y.id);
    out.push({
      kind: "genre",
      genreIds: [a.id, b.id],
      label: `More ${a.name.toLowerCase()} + ${b.name.toLowerCase()}`,
    });
  }

  return out;
}

/** Stable identity for cache tags. Keys on the axis, not the source title, so
 *  every title sharing an axis shares one cached group. */
export function axisKey(mediaType: "movie" | "tv", axis: TitleAxis): string {
  switch (axis.kind) {
    case "person":
    case "cast":
      return `axis:${mediaType}:${axis.kind}:${axis.personId}`;
    case "keyword":
      return `axis:${mediaType}:keyword:${axis.keywordId}`;
    case "genre":
      return `axis:${mediaType}:genre:${axis.genreIds[0]}-${axis.genreIds[1]}`;
  }
}
