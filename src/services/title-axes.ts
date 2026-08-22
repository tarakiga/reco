import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { toBrowseResults } from "@/lib/tmdb/discover";
import type { TitleResult } from "@/lib/tmdb/transform";
import type { TmdbSearchItem } from "@/lib/tmdb/types";
import { axisKey, type TitleAxis } from "@/lib/tmdb/axes";

export interface AxisGroup {
  label: string;
  items: TitleResult[];
}

const GROUP_SIZE = 12;
// One spare so dropping the source title still leaves a full rail.
const FETCH_SIZE = GROUP_SIZE + 1;

function discoverParams(mediaType: "movie" | "tv", axis: TitleAxis): Record<string, string> {
  const base: Record<string, string> = {
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": mediaType === "movie" ? "200" : "100",
  };
  // Exhaustive over TitleAxis, like axisKey in axes.ts: every case returns, so a
  // future fifth kind fails to compile here instead of silently issuing an
  // unfiltered discover call.
  switch (axis.kind) {
    case "person":
      return { ...base, with_crew: String(axis.personId) };
    case "cast":
      return { ...base, with_cast: String(axis.personId) };
    case "keyword":
      return { ...base, with_keywords: String(axis.keywordId) };
    case "genre":
      return { ...base, with_genres: `${axis.genreIds[0]},${axis.genreIds[1]}` };
  }
}

// TMDB genre ids too structural to signal a real "also like": talk, news, reality.
const LOW_QUALITY_GENRES = new Set([10767, 10763, 10764]);
// TMDB "Self" appearances (Self, Himself, Herself), not an acting role.
const SELF_CHARACTER = /(^|\W)self\b/i;

/** discover/tv has no people or cast filters, so TV person axes come from the
 *  person's combined credits instead: cast entries for the lead axis, crew for
 *  the maker axis (Creator credits when present, any TV crew credit otherwise). */
async function tvPersonItems(
  axis: Extract<TitleAxis, { kind: "person" | "cast" }>,
): Promise<TmdbSearchItem[]> {
  const person = await tmdb.getPerson(axis.personId);
  const pool: (TmdbSearchItem & { job?: string; character?: string; episode_count?: number })[] =
    axis.kind === "cast"
      ? (person.combined_credits?.cast ?? [])
      : (person.combined_credits?.crew ?? []);
  let tv = pool.filter(
    (c) =>
      c.media_type === "tv" &&
      !c.adult &&
      !(c.genre_ids ?? []).some((id) => LOW_QUALITY_GENRES.has(id)),
  );
  if (axis.kind === "cast") {
    tv = tv.filter(
      (c) =>
        !(c.character && SELF_CHARACTER.test(c.character)) &&
        !(c.episode_count !== undefined && c.episode_count < 3),
    );
  }
  if (axis.kind === "person") {
    const created = tv.filter((c) => c.job === "Creator");
    if (created.length) tv = created;
  }
  const seen = new Set<number>();
  const unique = tv.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  return unique.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

/** Cached per axis, not per source title, so every title sharing the axis
 *  shares one entry. Upstream failures throw out of here on purpose; a thrown
 *  error never fills the entry, so a TMDB blip is retried instead of pinning
 *  an empty group for days. The catch lives in the exported wrapper. */
async function groupCached(mediaType: "movie" | "tv", axis: TitleAxis): Promise<TitleResult[]> {
  "use cache";
  cacheLife("days");
  cacheTag(axisKey(mediaType, axis));

  const items =
    mediaType === "tv" && (axis.kind === "person" || axis.kind === "cast")
      ? await tvPersonItems(axis)
      : (await tmdb.discover(mediaType, discoverParams(mediaType, axis))).results;

  // Slice before mapping: a person's entire filmography can be long, and we
  // only need a small margin (30) over FETCH_SIZE so suppressed or adult drops
  // still leave enough for a full rail.
  return toBrowseResults(mediaType, items.slice(0, 30)).slice(0, FETCH_SIZE);
}

/** Titles for one axis, minus the source title. Never throws; empty items on failure. */
export async function axisGroup(
  mediaType: "movie" | "tv",
  axis: TitleAxis,
  excludeTmdbId: number,
): Promise<AxisGroup> {
  try {
    // label is display-only and must not participate in cache identity.
    const items = await groupCached(mediaType, { ...axis, label: "" });
    return {
      label: axis.label,
      items: items.filter((i) => i.tmdbId !== excludeTmdbId).slice(0, GROUP_SIZE),
    };
  } catch {
    return { label: axis.label, items: [] };
  }
}
