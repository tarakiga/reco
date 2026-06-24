import "server-only";
import { tmdb } from "@/lib/tmdb/client";
import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug } from "@/lib/slug";
import type { SceneResult } from "./scene-search";
import type { PersonQuery, PersonRole } from "@/lib/scene/person-query";

export interface PersonSearchOutcome {
  /** Resolved person's display name, or null when nothing credible matched. */
  personName: string | null;
  /** The role actually used (after resolving "adaptive" against the department). */
  role: PersonRole;
  results: SceneResult[];
}

const WRITER_JOBS = /\b(novel|author|writer|screenplay|story|teleplay|characters|book|comic)\b/i;
const CREATOR_JOBS = /\bcreator\b/i;
const DIRECTOR_JOBS = /\bdirector\b/i;

function normTokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

/** Levenshtein distance, capped use (names are short). */
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
}

/** A candidate token closely matches a person-name token (exact, or 1 typo for
 *  longer words — so "harlen" still resolves to "harlan"). */
function tokenClose(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && lev(a, b) <= 1;
}

/** Every candidate token must closely match some token of the person's name.
 *  Guards against common-noun false hits ("by a river" → River Phoenix). */
function nameMatches(candidate: string, personName: string): boolean {
  const ct = normTokens(candidate).filter((t) => t.length >= 2);
  const pt = normTokens(personName);
  if (ct.length === 0 || pt.length === 0) return false;
  return ct.every((c) => pt.some((p) => tokenClose(c, p)));
}

type CreditItem = {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  popularity?: number;
  job?: string;
};

/**
 * Resolve a "movies by <person>" query to that person's real credits via TMDB.
 * Adaptive by department: actors → roles they played; writers/creators/directors
 * → their authored/created/directed work (an explicit verb in `pq.role` wins).
 * Returns no person + empty results when nothing credible matches, so the caller
 * falls back to semantic search.
 */
export async function personSearch(
  pq: PersonQuery,
  opts: { limit?: number; mediaType?: "movie" | "tv" | null } = {},
): Promise<PersonSearchOutcome> {
  const fallbackRole: PersonRole = pq.role ?? "writing";

  let person: { id: number; name: string; dept: string } | null = null;
  try {
    const res = await tmdb.searchMulti(pq.name);
    const match = (res.results ?? [])
      .filter((r) => r.media_type === "person")
      .find((r) => nameMatches(pq.name, r.name ?? ""));
    if (match) person = { id: match.id, name: match.name ?? "", dept: match.known_for_department ?? "" };
  } catch {
    return { personName: null, role: fallbackRole, results: [] };
  }
  if (!person) return { personName: null, role: fallbackRole, results: [] };

  let cast: CreditItem[] = [];
  let crew: CreditItem[] = [];
  let dept = person.dept;
  try {
    const detail = await tmdb.getPerson(person.id);
    cast = (detail.combined_credits?.cast ?? []) as CreditItem[];
    crew = (detail.combined_credits?.crew ?? []) as CreditItem[];
    dept = dept || detail.known_for_department || "";
  } catch {
    return { personName: null, role: fallbackRole, results: [] };
  }

  // Effective role: explicit verb wins; otherwise adapt to the person's department.
  const role: PersonRole =
    pq.role ?? (dept === "Acting" ? "acting" : dept === "Directing" ? "directing" : "writing");

  let items: CreditItem[];
  if (role === "acting") {
    items = cast;
  } else if (role === "directing") {
    items = crew.filter((c) => DIRECTOR_JOBS.test(c.job ?? ""));
  } else if (role === "creator") {
    items = crew.filter((c) => CREATOR_JOBS.test(c.job ?? ""));
  } else {
    // writing / author: include creator credits too (authors who created the show).
    items = crew.filter((c) => WRITER_JOBS.test(c.job ?? "") || CREATOR_JOBS.test(c.job ?? ""));
  }

  const limit = opts.limit ?? 24;
  const seen = new Set<string>();
  const results: SceneResult[] = [];
  items
    .filter((i) => i.media_type === "movie" || i.media_type === "tv")
    .filter((i) => !opts.mediaType || i.media_type === opts.mediaType)
    .filter((i) => i.poster_path) // skip posterless rows (usually obscure/unreleased)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .forEach((i) => {
      if (results.length >= limit) return;
      const key = `${i.media_type}-${i.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      const mt = i.media_type as "movie" | "tv";
      const title = i.title ?? i.name ?? "Untitled";
      const dateStr = mt === "movie" ? i.release_date : i.first_air_date;
      const year = dateStr && dateStr.length >= 4 ? Number(dateStr.slice(0, 4)) : null;
      results.push({
        titleId: `p-${mt}-${i.id}`,
        tmdbId: i.id,
        mediaType: mt,
        title,
        year,
        posterUrl: posterUrl(i.poster_path ?? null),
        href: `/title/${mt}/${i.id}-${titleSlug(title, year ? `${year}` : null)}`,
        match: null,
      });
    });

  return { personName: person.name, role, results };
}
