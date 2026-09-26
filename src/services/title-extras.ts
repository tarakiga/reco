import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { sparql } from "@/lib/wikidata";

export interface NamedRef {
  /** Wikidata Q-id, e.g. "Q243556". */
  id: string;
  label: string;
}

export interface AwardSummary {
  wins: number;
  nominations: number;
  oscars: number;
  emmys: number;
}

export interface TitleExtrasData {
  awards: AwardSummary | null;
  basedOn: NamedRef[];
  filmingLocations: NamedRef[];
  narrativeLocations: NamedRef[];
}

const EMPTY: TitleExtrasData = {
  awards: null,
  basedOn: [],
  filmingLocations: [],
  narrativeLocations: [],
};

/** Cached per title. A Wikidata failure is cached as the empty shape for HOURS
 *  (not the days a real result gets): production showed Wikidata throttling us
 *  for weeks at a stretch, so refusing to cache failures meant every view of an
 *  uncached title held a function for the full client timeout, ~900 times a
 *  day. Hours keeps the panel self-healing without paying per view. A TMDB
 *  external-ids blip still throws (rare and genuinely transient, so not worth
 *  caching); the catch for that lives in the exported wrapper. */
async function extrasCached(mediaType: "movie" | "tv", tmdbId: number): Promise<TitleExtrasData> {
  "use cache";
  cacheTag(`title-extras:${mediaType}:${tmdbId}`);

  // Every path below sets exactly one cacheLife: days for durable answers
  // (awards and source links are near-static), hours for a failed call.
  const wikidataId = (await tmdb.externalIds(mediaType, tmdbId)).wikidata_id ?? null;
  if (!wikidataId) {
    cacheLife("days");
    return EMPTY;
  }

  const query = `SELECT ?prop ?val ?valLabel WHERE {
    VALUES (?prop ?p) {
      ('award' wdt:P166) ('nominated' wdt:P1411)
      ('basedon' wdt:P144) ('filming' wdt:P915) ('setin' wdt:P840)
    }
    wd:${wikidataId} ?p ?val.
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;

  const bindings = await sparql<{
    prop?: { value: string };
    val?: { value: string };
    valLabel?: { value: string };
  }>(query, `title-extras:${mediaType}:${tmdbId}`);
  if (!bindings) {
    cacheLife("hours");
    return EMPTY;
  }
  cacheLife("days");

  const groups: Record<string, NamedRef[]> = {};
  const seen: Record<string, Set<string>> = {};
  for (const b of bindings) {
    const prop = b.prop?.value;
    const uri = b.val?.value;
    const label = b.valLabel?.value;
    if (!prop || !uri || !label) continue;
    const qid = uri.split("/").pop()!;
    (seen[prop] ??= new Set());
    if (seen[prop].has(qid)) continue;
    seen[prop].add(qid);
    (groups[prop] ??= []).push({ id: qid, label });
  }

  const awardList = groups.award ?? [];
  const nomList = groups.nominated ?? [];
  const countKw = (list: NamedRef[], kw: string) =>
    list.filter((a) => a.label.toLowerCase().includes(kw)).length;
  const awards: AwardSummary | null =
    awardList.length || nomList.length
      ? {
          wins: awardList.length,
          nominations: nomList.length,
          oscars: countKw(awardList, "academy award"),
          emmys: countKw(awardList, "emmy"),
        }
      : null;

  return {
    awards,
    basedOn: groups.basedon ?? [],
    filmingLocations: groups.filming ?? [],
    narrativeLocations: groups.setin ?? [],
  };
}

/** Awards, source material, and locations for a title, sourced from Wikidata.
 *  Never throws; the empty shape on any failure. */
export async function titleExtras(mediaType: "movie" | "tv", tmdbId: number): Promise<TitleExtrasData> {
  try {
    return await extrasCached(mediaType, tmdbId);
  } catch {
    return EMPTY;
  }
}
