import "server-only";
import { cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug } from "@/lib/slug";

export interface ListingItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
}
export interface Listing {
  heading: string;
  items: ListingItem[];
}

const WD_HEADERS = {
  "User-Agent": "reco/1.0 (https://reco-pink.vercel.app)",
  Accept: "application/sparql-results+json",
};

export function isWikidataQid(id: string): boolean {
  return /^Q\d+$/.test(id);
}

interface RawRow {
  tmdbId: number;
  mediaType: "movie" | "tv";
}

async function build(qid: string, itemClause: string): Promise<Listing> {
  const query = `SELECT DISTINCT ?tmdb ?mt ?srcLabel WHERE {
    BIND(wd:${qid} AS ?src)
    ${itemClause}
    { ?item wdt:P4947 ?tmdb. BIND("movie" AS ?mt) }
    UNION { ?item wdt:P4983 ?tmdb. BIND("tv" AS ?mt) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;

  let bindings: { tmdb?: { value: string }; mt?: { value: string }; srcLabel?: { value: string } }[];
  try {
    const res = await fetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
      { headers: WD_HEADERS },
    );
    if (!res.ok) return { heading: "", items: [] };
    bindings = ((await res.json()) as { results?: { bindings?: typeof bindings } }).results?.bindings ?? [];
  } catch {
    return { heading: "", items: [] };
  }

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
          const t = await tmdb.titleBrief(r.mediaType, r.tmdbId);
          if (t.adult) return null; // never surface adult titles
          const name = (r.mediaType === "tv" ? t.name : t.title) ?? "Untitled";
          const date = (r.mediaType === "tv" ? t.first_air_date : t.release_date) ?? "";
          const year = date.length >= 4 ? Number(date.slice(0, 4)) : null;
          return {
            tmdbId: r.tmdbId,
            mediaType: r.mediaType,
            title: name,
            year: Number.isFinite(year) ? year : null,
            posterUrl: posterUrl(t.poster_path),
            href: `/title/${r.mediaType}/${r.tmdbId}-${titleSlug(name, date || null)}`,
          };
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
  cacheTag(`wd-source:${qid}`);
  if (!isWikidataQid(qid)) return { heading: "", items: [] };
  return build(qid, `?item wdt:P144 ?src.`);
}

/** Every movie/show filmed in or set in a given Wikidata place. */
export async function titlesByLocation(qid: string): Promise<Listing> {
  "use cache";
  cacheTag(`wd-location:${qid}`);
  if (!isWikidataQid(qid)) return { heading: "", items: [] };
  return build(qid, `?item (wdt:P915|wdt:P840) ?src.`);
}
