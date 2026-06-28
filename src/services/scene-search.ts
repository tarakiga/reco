import "server-only";
import { toVectorLiteral } from "@/db/vector";
import { nearestTitles } from "@/db/vector-search";
import { matchPercent } from "@/lib/taste/match";
import { titleSlug } from "@/lib/slug";
import { posterUrl } from "@/lib/tmdb/images";
import { defaultEmbedder, type Embedder } from "@/lib/taste/embedder";
import { parseMediaIntent, type SceneMediaType } from "@/lib/scene/intent";
import { parseQueryFilters } from "@/lib/scene/filters";
import { parsePersonQuery } from "@/lib/scene/person-query";
import { expandSceneQuery } from "@/lib/scene/expand";
import { discoverSearch } from "./discover-search";
import { personSearch } from "./person-search";

export interface SceneResult {
  titleId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  /** Cosine match % for semantic results; null for structured (Discover) results. */
  match: number | null;
}

const MIN_WORDS = 3;
const MIN_SIMILARITY = 0.15; // drop near-random matches so nonsense → "nothing matched"
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 40;

/**
 * Semantic "search by scene": embed the description as a query vector and return
 * the nearest titles by cosine similarity. `embedder` is injectable for tests.
 */
export async function searchByScene(
  query: string,
  opts: { limit?: number; mediaType?: "movie" | "tv" } = {},
  embedder: Embedder = defaultEmbedder(),
): Promise<SceneResult[]> {
  const q = query.trim();
  if (q.split(/\s+/).filter(Boolean).length < MIN_WORDS) return [];

  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  let qvec: number[];
  try {
    [qvec] = await embedder.embed([q], "query");
  } catch {
    return []; // embedding provider failure → graceful empty
  }
  const vec = toVectorLiteral(qvec);

  // When filtering by media type, over-fetch then filter in app: the ANN search
  // runs over embeddings alone (so the cosine index is used) and can't pre-filter
  // by t.media_type without forcing a brute-force scan.
  const fetchLimit = opts.mediaType ? Math.min(limit * 8, 200) : limit;

  return (await nearestTitles(vec, fetchLimit))
    .filter((r) => r.cos >= MIN_SIMILARITY)
    .filter((r) => !opts.mediaType || r.media_type === opts.mediaType)
    .slice(0, limit)
    .map((r) => {
      const year = r.release_year;
      return {
        titleId: r.id,
        tmdbId: r.tmdb_id,
        mediaType: r.media_type,
        title: r.title,
        year,
        posterUrl: posterUrl(r.poster_path),
        href: `/title/${r.media_type}/${r.tmdb_id}-${titleSlug(r.title, year ? `${year}` : null)}`,
        match: matchPercent(r.cos),
      };
    });
}

export interface SceneSearchOutcome {
  results: SceneResult[];
  /** Media filter actually applied (null = no filter / all). */
  mediaType: SceneMediaType | null;
  /** Media type auto-detected from the raw query text, if any. */
  detected: SceneMediaType | null;
  /** How the results were produced: a person's credits, structured Discover, or
   *  semantic vectors. */
  mode: "discover" | "semantic" | "person";
  /** Filter summary for the UI when mode = discover (e.g. "1980s · cult"). */
  summary: string | null;
}

/**
 * Full scene-search pipeline: detect + strip a media-type hint, expand the vague
 * query for recall, then run the filtered vector search. `override` lets the UI
 * force a media type ("all" disables the filter); when omitted, auto-detect wins.
 */
export async function sceneSearch(
  rawQuery: string,
  opts: { limit?: number; override?: SceneMediaType | "all" } = {},
): Promise<SceneSearchOutcome> {
  const overrideMt = opts.override === "movie" || opts.override === "tv" ? opts.override : null;

  // Person-attribution ("movies by Harlan Coben", "directed by Nolan") → that
  // person's real credits, not vibe-similarity. Resolving the name on TMDB is
  // the confirmation: if it doesn't match a credible person, fall through.
  const pq = parsePersonQuery(rawQuery);
  if (pq) {
    const mt = overrideMt ?? pq.mediaType;
    const person = await personSearch(pq, { limit: opts.limit ?? 20, mediaType: mt });
    if (person.results.length > 0) {
      const verb = person.role === "acting" ? "with" : "by";
      return {
        results: person.results,
        mediaType: mt,
        detected: pq.mediaType,
        mode: "person",
        summary: person.personName ? `${verb} ${person.personName}` : null,
      };
    }
    // no credible person — fall through to catalog / semantic search
  }

  // Catalog/filter queries ("cult classics from the 80s") → structured Discover
  // with a quality sort + vote floor, which beats vector similarity here.
  const filters = parseQueryFilters(rawQuery);
  if (filters.isCatalog) {
    const mt = overrideMt ?? filters.mediaType;
    const discovered = await discoverSearch({ ...filters, mediaType: mt }, opts.limit ?? 20);
    if (discovered.length > 0) {
      return { results: discovered, mediaType: mt, detected: filters.detectedMedia, mode: "discover", summary: filters.summary };
    }
    // fall through to semantic if Discover came back empty
  }

  const { mediaType: detected, cleaned } = parseMediaIntent(rawQuery);
  const mediaType: SceneMediaType | null =
    opts.override === undefined ? detected : opts.override === "all" ? null : opts.override;
  const expanded = await expandSceneQuery(cleaned);
  const results = await searchByScene(expanded, { limit: opts.limit, mediaType: mediaType ?? undefined });
  return { results, mediaType, detected, mode: "semantic", summary: null };
}
