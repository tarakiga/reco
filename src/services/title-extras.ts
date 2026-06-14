import "server-only";
import { cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";

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

const WD_HEADERS = {
  "User-Agent": "reco/1.0 (https://reco-pink.vercel.app)",
  Accept: "application/sparql-results+json",
};

/** Awards, source material, and locations for a title, sourced from Wikidata.
 *  Cached per title; returns empties on no-wikidata-id or error. */
export async function titleExtras(mediaType: "movie" | "tv", tmdbId: number): Promise<TitleExtrasData> {
  "use cache";
  cacheTag(`title-extras:${mediaType}:${tmdbId}`);

  let wikidataId: string | null = null;
  try {
    wikidataId = (await tmdb.externalIds(mediaType, tmdbId)).wikidata_id ?? null;
  } catch {
    return EMPTY;
  }
  if (!wikidataId) return EMPTY;

  const query = `SELECT ?prop ?val ?valLabel WHERE {
    VALUES (?prop ?p) {
      ('award' wdt:P166) ('nominated' wdt:P1411)
      ('basedon' wdt:P144) ('filming' wdt:P915) ('setin' wdt:P840)
    }
    wd:${wikidataId} ?p ?val.
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;

  let bindings: { prop?: { value: string }; val?: { value: string }; valLabel?: { value: string } }[];
  try {
    const res = await fetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
      { headers: WD_HEADERS },
    );
    if (!res.ok) return EMPTY;
    bindings = ((await res.json()) as { results?: { bindings?: typeof bindings } }).results?.bindings ?? [];
  } catch {
    return EMPTY;
  }

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
