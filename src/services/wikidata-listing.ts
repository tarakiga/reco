import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { tmdbBriefToTitleResult } from "@/lib/tmdb/brief";
import type { TitleResult } from "@/lib/tmdb/transform";
import { sparql } from "@/lib/wikidata";

export type ListingItem = TitleResult;
export interface Listing {
  heading: string;
  items: ListingItem[];
}

export function isWikidataQid(id: string): boolean {
  return /^Q\d+$/.test(id);
}

interface RawRow {
  tmdbId: number;
  mediaType: "movie" | "tv";
}

/** Cached per place. Throws on a failed SPARQL call ON PURPOSE: an error thrown
 *  from inside "use cache" does not fill the entry, so a Wikidata timeout is
 *  retried on the next request instead of freezing an empty page for days,
 *  which is exactly what happened in production. The catch lives in the outer
 *  wrappers, outside the boundary. */
async function build(qid: string, itemClause: string, label: string, tag: string): Promise<Listing> {
  "use cache";
  cacheLife("days");
  cacheTag(tag);

  const query = `SELECT DISTINCT ?tmdb ?mt ?srcLabel WHERE {
    BIND(wd:${qid} AS ?src)
    ${itemClause}
    { ?item wdt:P4947 ?tmdb. BIND("movie" AS ?mt) }
    UNION { ?item wdt:P4983 ?tmdb. BIND("tv" AS ?mt) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;

  const bindings = await sparql<{
    tmdb?: { value: string };
    mt?: { value: string };
    srcLabel?: { value: string };
  }>(query, label);
  if (!bindings) throw new Error(`wikidata unavailable: ${label}`);

  const heading = bindings[0]?.srcLabel?.value ?? "";
  const seen = new Set<number>();
  const rows: RawRow[] = [];
  for (const b of bindings) {
    const tmdbId = Number(b.tmdb?.value);
    const mt = b.mt?.value;
    if (!Number.isInteger(tmdbId) || (mt !== "movie" && mt !== "tv") || seen.has(tmdbId)) continue;
    seen.add(tmdbId);
    rows.push({ tmdbId, mediaType: mt });
  }

  const items = (
    await Promise.all(
      rows.slice(0, 40).map(async (r): Promise<ListingItem | null> => {
        try {
          // Null for adult titles too, which we never surface.
          const brief = await tmdb.titleBrief(r.mediaType, r.tmdbId);
          return tmdbBriefToTitleResult(r.mediaType, r.tmdbId, brief);
        } catch {
          return null;
        }
      }),
    )
  ).filter((x): x is ListingItem => x !== null);

  items.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  return { heading, items };
}

const EMPTY_LISTING: Listing = { heading: "", items: [] };

/** Every movie/show based on a given Wikidata source work. Never throws. */
export async function titlesBySource(qid: string): Promise<Listing> {
  if (!isWikidataQid(qid)) return EMPTY_LISTING;
  try {
    return await build(qid, `?item wdt:P144 ?src.`, `wd-source:${qid}`, `wd-source:${qid}`);
  } catch {
    return EMPTY_LISTING;
  }
}

/** Every movie/show filmed in or set in a given Wikidata place. Never throws. */
export async function titlesByLocation(qid: string): Promise<Listing> {
  if (!isWikidataQid(qid)) return EMPTY_LISTING;
  try {
    return await build(qid, `?item (wdt:P915|wdt:P840) ?src.`, `wd-location:${qid}`, `wd-location:${qid}`);
  } catch {
    return EMPTY_LISTING;
  }
}
