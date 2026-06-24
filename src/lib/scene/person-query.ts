import { parseMediaIntent } from "./intent";

export type PersonRole = "acting" | "directing" | "writing" | "creator";

export interface PersonQuery {
  /** The name candidate to resolve against TMDB (lowercased, media words stripped). */
  name: string;
  /** Explicit role from the verb, or null = adaptive on the person's department. */
  role: PersonRole | null;
  mediaType: "movie" | "tv" | null;
}

// Words to drop from the name candidate (media nouns + leading articles).
const DROP = new Set(["a", "an", "the", "movies", "movie", "films", "film", "shows", "show", "series", "tv"]);

// Connectors that introduce a person, in priority order (specific verbs first).
// `minTokens` guards the ambiguous plain "by/from": a bare single word after it
// ("by a river", "from the sea") is almost never a person, so require a full
// name (2+ tokens). Explicit verbs ("directed by") are trusted at 1+ token.
// NOTE: "with" is deliberately excluded — far too common in scene descriptions
// ("a movie with a giant squid") to ever treat as a person hint.
const CONNECTORS: { re: RegExp; role: PersonRole | null; minTokens: number }[] = [
  { re: /\b(?:directed|helmed)\s+by\s+/i, role: "directing", minTokens: 1 },
  { re: /\bcreated\s+by\s+/i, role: "creator", minTokens: 1 },
  { re: /\b(?:written|penned|authored)\s+by\s+/i, role: "writing", minTokens: 1 },
  { re: /\bbased\s+on\s+(?:the\s+)?(?:books?|novels?|stor(?:y|ies)|writing|work)\s+(?:by|of)\s+/i, role: "writing", minTokens: 1 },
  { re: /\bstarring\s+/i, role: "acting", minTokens: 1 },
  { re: /\b(?:by|from)\s+/i, role: null, minTokens: 2 },
];

/**
 * Detect a "movies by <person>" style query and pull out the name + intended
 * role. Returns null for anything that isn't a person-attribution query, so the
 * caller falls back to normal scene search. Detection is intentionally
 * conservative; the real confirmation is resolving the name against TMDB.
 */
export function parsePersonQuery(raw: string): PersonQuery | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  for (const c of CONNECTORS) {
    const m = text.match(c.re);
    if (!m || m.index == null) continue;
    const after = text.slice(m.index + m[0].length).trim();
    if (!after) continue;
    const tokens = after
      .toLowerCase()
      .replace(/[^a-z0-9'.\s-]/gi, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !DROP.has(w));
    if (tokens.length < c.minTokens || tokens.length === 0) continue;
    const name = tokens.join(" ").trim();
    if (name.length < 3) continue;
    return { name, role: c.role, mediaType: parseMediaIntent(text).mediaType };
  }
  return null;
}
