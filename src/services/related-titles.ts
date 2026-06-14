import "server-only";
import { cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug } from "@/lib/slug";

export type RelatedMediaType = "movie" | "tv";

export interface RelatedTitle {
  tmdbId: number;
  mediaType: RelatedMediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
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

async function wikidataRelated(
  mediaType: RelatedMediaType,
  wikidataId: string,
): Promise<{ tmdbId: number; relation: string }[]> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(buildQuery(mediaType, wikidataId))}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "reco/1.0 (https://reco-pink.vercel.app)",
      Accept: "application/sparql-results+json",
    },
  });
  if (!res.ok) throw new Error(`Wikidata query failed (${res.status})`);
  const data = (await res.json()) as { results?: { bindings?: { tmdb?: { value: string }; rel?: { value: string } }[] } };

  const out: { tmdbId: number; relation: string }[] = [];
  const seen = new Set<number>();
  for (const b of data.results?.bindings ?? []) {
    const tmdbId = Number(b.tmdb?.value);
    if (!Number.isInteger(tmdbId) || seen.has(tmdbId)) continue;
    seen.add(tmdbId);
    out.push({ tmdbId, relation: b.rel?.value ?? "basedon" });
  }
  return out;
}

/** Wikidata-sourced related titles (spin-offs / remakes / franchise / other
 *  versions). Cached per title; [] when no Wikidata id, no relations, or error. */
export async function relatedTitles(mediaType: RelatedMediaType, tmdbId: number): Promise<RelatedTitle[]> {
  "use cache";
  cacheTag(`related:${mediaType}:${tmdbId}`);

  let wikidataId: string | null = null;
  try {
    const ext = await tmdb.externalIds(mediaType, tmdbId);
    wikidataId = ext.wikidata_id ?? null;
  } catch {
    return [];
  }
  if (!wikidataId) return [];

  let rels: { tmdbId: number; relation: string }[];
  try {
    rels = await wikidataRelated(mediaType, wikidataId);
  } catch {
    return [];
  }

  const cards = await Promise.all(
    rels.slice(0, 12).map(async (r): Promise<RelatedTitle | null> => {
      try {
        const t = await tmdb.titleBrief(mediaType, r.tmdbId);
        const title = (mediaType === "tv" ? t.name : t.title) ?? "Untitled";
        const date = (mediaType === "tv" ? t.first_air_date : t.release_date) ?? "";
        const year = date.length >= 4 ? Number(date.slice(0, 4)) : null;
        return {
          tmdbId: r.tmdbId,
          mediaType,
          title,
          year: Number.isFinite(year) ? year : null,
          posterUrl: posterUrl(t.poster_path),
          href: `/title/${mediaType}/${r.tmdbId}-${titleSlug(title, date || null)}`,
          relation: RELATION_LABEL[r.relation] ?? "Related",
        };
      } catch {
        return null;
      }
    }),
  );
  return cards.filter((c): c is RelatedTitle => c !== null);
}
