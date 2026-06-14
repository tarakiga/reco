import "server-only";
import { cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug } from "@/lib/slug";

export interface RelatedShow {
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  relation: string;
}

const RELATION_LABEL: Record<string, string> = {
  spinoff: "Spin-off / remake",
  basedon: "Based on",
  franchise: "Same franchise",
  universe: "Shared universe",
};

/** Query Wikidata for TV series related to `wikidataId`, deduped, with TMDB ids. */
async function wikidataRelated(wikidataId: string): Promise<{ tmdbId: number; relation: string }[]> {
  const query = `SELECT DISTINCT ?tmdb ?rel WHERE {
    VALUES ?src { wd:${wikidataId} }
    { ?src wdt:P179 ?s. ?item wdt:P179 ?s. BIND('franchise' AS ?rel) }
    UNION { ?src wdt:P1080 ?u. ?item wdt:P1080 ?u. BIND('universe' AS ?rel) }
    UNION { ?item wdt:P144 ?src. BIND('spinoff' AS ?rel) }
    UNION { ?src wdt:P144 ?item. BIND('basedon' AS ?rel) }
    ?item wdt:P4983 ?tmdb.
    FILTER(?item != ?src)
  }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
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

/** Spin-offs / remakes / franchise-mates for a TV show, sourced from Wikidata.
 *  Cached per show; returns [] when the show has no Wikidata id or no relations. */
export async function relatedShows(tvId: number): Promise<RelatedShow[]> {
  "use cache";
  cacheTag(`related-shows:${tvId}`);

  let wikidataId: string | null = null;
  try {
    const ext = await tmdb.externalIds("tv", tvId);
    wikidataId = ext.wikidata_id ?? null;
  } catch {
    return [];
  }
  if (!wikidataId) return [];

  let rels: { tmdbId: number; relation: string }[];
  try {
    rels = await wikidataRelated(wikidataId);
  } catch {
    return [];
  }

  const cards = await Promise.all(
    rels.slice(0, 12).map(async (r): Promise<RelatedShow | null> => {
      try {
        const t = await tmdb.tvBrief(r.tmdbId);
        const name = t.name ?? "Untitled";
        const date = t.first_air_date ?? "";
        const year = date.length >= 4 ? Number(date.slice(0, 4)) : null;
        return {
          tmdbId: r.tmdbId,
          title: name,
          year: Number.isFinite(year) ? year : null,
          posterUrl: posterUrl(t.poster_path),
          href: `/title/tv/${r.tmdbId}-${titleSlug(name, date || null)}`,
          relation: RELATION_LABEL[r.relation] ?? "Related",
        };
      } catch {
        return null;
      }
    }),
  );
  return cards.filter((c): c is RelatedShow => c !== null);
}
