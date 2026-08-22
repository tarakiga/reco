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

/** Cached per title. Failures THROW on purpose so they never fill the cache
 *  entry: a Wikidata timeout used to cache the empty shape for days, hiding
 *  awards and the Filmed-in links until the entry expired. Only real data and
 *  the durable no-wikidata-id fact are cached; the catch lives in the exported
 *  wrapper, outside the boundary. */
async function extrasCached(mediaType: "movie" | "tv", tmdbId: number): Promise<TitleExtrasData> {
  "use cache";
  // Awards and source-material links are near-static, so the default profile's
  // ~15 minute revalidate was re-querying Wikidata far more than needed.
  cacheLife("days");
  cacheTag(`title-extras:${mediaType}:${tmdbId}`);

  const wikidataId = (await tmdb.externalIds(mediaType, tmdbId)).wikidata_id ?? null;
  if (!wikidataId) return EMPTY;

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
  if (!bindings) throw new Error(`wikidata unavailable: title-extras:${mediaType}:${tmdbId}`);

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
