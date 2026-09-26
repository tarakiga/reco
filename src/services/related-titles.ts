import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { tmdbBriefToTitleResult } from "@/lib/tmdb/brief";
import type { TitleResult } from "@/lib/tmdb/transform";
import { sparql } from "@/lib/wikidata";

export type RelatedMediaType = "movie" | "tv";

export interface RelatedTitle extends TitleResult {
  relation: string;
}

const RELATION_LABEL: Record<string, string> = {
  franchise: "Same franchise",
  universe: "Shared universe",
  spinoff: "Spin-off / remake",
  basedon: "Based on",
  sharedsource: "Another version",
  remake: "Remake",
};

/** SPARQL clauses + Wikidata "TMDB id" property differ by media type. */
function buildQuery(mediaType: RelatedMediaType, wikidataId: string): string {
  const tmdbProp = mediaType === "tv" ? "P4983" : "P4947";
  const clauses =
    mediaType === "tv"
      ? `{ ?src wdt:P179 ?s. ?item wdt:P179 ?s. BIND('franchise' AS ?rel) }
         UNION { ?src wdt:P1080 ?u. ?item wdt:P1080 ?u. BIND('universe' AS ?rel) }
         UNION { ?item wdt:P144 ?src. BIND('spinoff' AS ?rel) }
         UNION { ?src wdt:P144 ?item. BIND('basedon' AS ?rel) }`
      : // movies: sequels/franchise are covered by the TMDB collection rail, so
        // this only surfaces remakes / other versions of the same story.
        `{ ?src wdt:P144 ?o. ?item wdt:P144 ?o. BIND('sharedsource' AS ?rel) }
         UNION { ?item wdt:P144 ?src. BIND('remake' AS ?rel) }
         UNION { ?src wdt:P144 ?item. BIND('sharedsource' AS ?rel) }`;
  return `SELECT DISTINCT ?tmdb ?rel WHERE {
    VALUES ?src { wd:${wikidataId} }
    ${clauses}
    ?item wdt:${tmdbProp} ?tmdb.
    FILTER(?item != ?src)
  }`;
}

/** Null means the SPARQL call itself failed; the caller decides how to cache that. */
async function wikidataRelated(
  mediaType: RelatedMediaType,
  wikidataId: string,
): Promise<{ tmdbId: number; relation: string }[] | null> {
  const bindings = await sparql<{ tmdb?: { value: string }; rel?: { value: string } }>(
    buildQuery(mediaType, wikidataId),
    `related:${mediaType}:${wikidataId}`,
  );
  if (!bindings) return null;

  const out: { tmdbId: number; relation: string }[] = [];
  const seen = new Set<number>();
  for (const b of bindings) {
    const tmdbId = Number(b.tmdb?.value);
    if (!Number.isInteger(tmdbId) || seen.has(tmdbId)) continue;
    seen.add(tmdbId);
    out.push({ tmdbId, relation: b.rel?.value ?? "basedon" });
  }
  return out;
}

/** Cached per title. A Wikidata failure is cached as an empty rail for HOURS
 *  (not the days a real result gets): production showed Wikidata throttling us
 *  for weeks at a stretch, so refusing to cache failures meant every view of an
 *  uncached title held a function for the full client timeout, ~900 times a
 *  day. Hours keeps the rail self-healing without paying per view. A TMDB
 *  external-ids blip still throws (rare and genuinely transient, so not worth
 *  caching); the catch for that lives in the exported wrapper. */
async function relatedCached(mediaType: RelatedMediaType, tmdbId: number): Promise<RelatedTitle[]> {
  "use cache";
  cacheTag(`related:${mediaType}:${tmdbId}`);

  // Every path below sets exactly one cacheLife: days for durable answers
  // (franchise and remake links are near-static), hours for a failed call.
  const wikidataId = (await tmdb.externalIds(mediaType, tmdbId)).wikidata_id ?? null;
  if (!wikidataId) {
    cacheLife("days");
    return [];
  }

  const rels = await wikidataRelated(mediaType, wikidataId);
  if (rels === null) {
    cacheLife("hours");
    return [];
  }
  cacheLife("days");

  const cards = await Promise.all(
    rels.slice(0, 12).map(async (r): Promise<RelatedTitle | null> => {
      try {
        // Null for adult titles too (e.g. parodies reached via Wikidata).
        const brief = await tmdb.titleBrief(mediaType, r.tmdbId);
        const card = tmdbBriefToTitleResult(mediaType, r.tmdbId, brief);
        return card && { ...card, relation: RELATION_LABEL[r.relation] ?? "Related" };
      } catch {
        return null;
      }
    }),
  );
  return cards.filter((c): c is RelatedTitle => c !== null);
}

/** Wikidata-sourced related titles (spin-offs / remakes / franchise / other
 *  versions). Never throws; [] when no Wikidata id, no relations, or error. */
export async function relatedTitles(mediaType: RelatedMediaType, tmdbId: number): Promise<RelatedTitle[]> {
  try {
    return await relatedCached(mediaType, tmdbId);
  } catch {
    return [];
  }
}
