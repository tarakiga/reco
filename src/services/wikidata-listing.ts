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

async function build(qid: string, itemClause: string, label: string): Promise<Listing> {
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
  if (!bindings) return { heading: "", items: [] };

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

/** Every movie/show based on a given Wikidata source work. */
export async function titlesBySource(qid: string): Promise<Listing> {
  "use cache";
  // Adaptations of a source work change rarely; the default ~15 minute
  // revalidate was re-running this SPARQL far more often than needed.
  cacheLife("days");
  cacheTag(`wd-source:${qid}`);
  if (!isWikidataQid(qid)) return { heading: "", items: [] };
  return build(qid, `?item wdt:P144 ?src.`, `wd-source:${qid}`);
}

/** Every movie/show filmed in or set in a given Wikidata place. */
export async function titlesByLocation(qid: string): Promise<Listing> {
  "use cache";
  cacheLife("days");
  cacheTag(`wd-location:${qid}`);
  if (!isWikidataQid(qid)) return { heading: "", items: [] };
  return build(qid, `?item (wdt:P915|wdt:P840) ?src.`, `wd-location:${qid}`);
}
