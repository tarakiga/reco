import { parseMediaIntent, type SceneMediaType } from "./intent";

/**
 * Structured filters parsed out of a "catalog" query like "cult classics from
 * the 80s" or "best 90s sci-fi". These route to TMDB Discover (decade + genre +
 * a quality sort/vote-floor) instead of the vector search — which is far better
 * at filter/reputation queries than semantic similarity.
 */
export interface QueryFilters {
  mediaType: SceneMediaType;
  detectedMedia: SceneMediaType | null;
  yearGte: number | null;
  yearLte: number | null;
  genreIds: number[];
  /** Genres to exclude (Documentary/Music) so acclaimed concert films + docs
   *  don't dominate "best/cult/classic" lists — unless explicitly requested. */
  excludeGenreIds: number[];
  sort: string; // TMDB sort_by
  voteFloor: number;
  voteCeil: number | null;
  /** True when the query is mostly filters (route to Discover, not vectors). */
  isCatalog: boolean;
  /** Human-readable filter summary for the UI, e.g. "1980s · cult · Sci-Fi". */
  summary: string;
}

const DECADE_WORDS: Record<string, number> = {
  fifties: 1950, sixties: 1960, seventies: 1970, eighties: 1980, nineties: 1990,
};

const GENRES: Record<string, { movie: number; tv: number | null; label: string }> = {
  action: { movie: 28, tv: 10759, label: "Action" },
  adventure: { movie: 12, tv: 10759, label: "Adventure" },
  animated: { movie: 16, tv: 16, label: "Animation" },
  animation: { movie: 16, tv: 16, label: "Animation" },
  anime: { movie: 16, tv: 16, label: "Animation" },
  comedy: { movie: 35, tv: 35, label: "Comedy" },
  comedies: { movie: 35, tv: 35, label: "Comedy" },
  crime: { movie: 80, tv: 80, label: "Crime" },
  documentary: { movie: 99, tv: 99, label: "Documentary" },
  documentaries: { movie: 99, tv: 99, label: "Documentary" },
  drama: { movie: 18, tv: 18, label: "Drama" },
  dramas: { movie: 18, tv: 18, label: "Drama" },
  family: { movie: 10751, tv: 10751, label: "Family" },
  fantasy: { movie: 14, tv: 10765, label: "Fantasy" },
  horror: { movie: 27, tv: null, label: "Horror" },
  musical: { movie: 10402, tv: null, label: "Music" },
  mystery: { movie: 9648, tv: 9648, label: "Mystery" },
  romance: { movie: 10749, tv: null, label: "Romance" },
  romantic: { movie: 10749, tv: null, label: "Romance" },
  thriller: { movie: 53, tv: null, label: "Thriller" },
  thrillers: { movie: 53, tv: null, label: "Thriller" },
  war: { movie: 10752, tv: 10768, label: "War" },
  western: { movie: 37, tv: 37, label: "Western" },
  westerns: { movie: 37, tv: 37, label: "Western" },
};
const SCIFI = { movie: 878, tv: 10765, label: "Sci-Fi" };

const REPUTATION: { test: RegExp; sort: string; voteFloor: number; voteCeil: number | null; label: string }[] = [
  { test: /\bcult\b/, sort: "vote_average.desc", voteFloor: 150, voteCeil: null, label: "cult" },
  { test: /\b(classics?|acclaimed|iconic|essential|greatest|masterpieces?|must[-\s]?watch|top[-\s]?rated|best)\b/, sort: "vote_average.desc", voteFloor: 500, voteCeil: null, label: "top-rated" },
  { test: /\b(underrated|hidden\s+gems?|overlooked|obscure|under[-\s]?the[-\s]?radar)\b/, sort: "vote_average.desc", voteFloor: 40, voteCeil: 1500, label: "underrated" },
  { test: /\b(highest[-\s]?grossing|grossing|box[-\s]?office)\b/, sort: "revenue.desc", voteFloor: 50, voteCeil: null, label: "highest-grossing" },
  { test: /\b(popular|blockbusters?|hits?|crowd[-\s]?pleasers?)\b/, sort: "popularity.desc", voteFloor: 100, voteCeil: null, label: "popular" },
];

const STOP = new Set([
  "the", "a", "an", "of", "from", "in", "on", "with", "and", "or", "for", "to",
  "that", "this", "some", "good", "great", "me", "find", "like", "show", "shows",
]);

const strip = (s: string, re: RegExp) => s.replace(new RegExp(re.source, "gi"), " ");

export function parseQueryFilters(raw: string): QueryFilters {
  const { mediaType: detectedMedia } = parseMediaIntent(raw);
  const mediaType: SceneMediaType = detectedMedia ?? "movie";
  let working = ` ${(raw ?? "").toLowerCase()} `;
  const summary: string[] = [];

  // --- decade / year ---
  let yearGte: number | null = null;
  let yearLte: number | null = null;
  for (const [word, start] of Object.entries(DECADE_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(working)) {
      yearGte = start;
      yearLte = start + 9;
      working = strip(working, new RegExp(`\\b${word}\\b`));
      break;
    }
  }
  if (yearGte == null) {
    const m = working.match(/\b((?:19|20)\d0)s\b/); // 1980s, 2010s
    if (m) {
      yearGte = Number(m[1]);
      yearLte = yearGte + 9;
      working = strip(working, /\b(?:19|20)\d0s\b/);
    }
  }
  if (yearGte == null) {
    const m = working.match(/\b'?(\d0)'?s\b/); // 80s, '90s, 00s, 10s
    if (m) {
      const n = Number(m[1]);
      yearGte = n >= 30 ? 1900 + n : 2000 + n;
      yearLte = yearGte + 9;
      working = strip(working, /\b'?\d0'?s\b/);
    }
  }
  if (yearGte == null) {
    const m = working.match(/\b((?:19|20)\d{2})\b/); // exact year 1985
    if (m) {
      yearGte = Number(m[1]);
      yearLte = yearGte;
      working = strip(working, /\b(?:19|20)\d{2}\b/);
    }
  }
  if (yearGte != null) summary.push(yearGte === yearLte ? `${yearGte}` : `${yearGte}s`);

  // --- reputation → sort + vote floor ---
  let sort = "popularity.desc";
  let voteFloor = 50;
  let voteCeil: number | null = null;
  let hasReputation = false;
  for (const r of REPUTATION) {
    if (r.test.test(working)) {
      sort = r.sort;
      voteFloor = r.voteFloor;
      voteCeil = r.voteCeil;
      hasReputation = true;
      summary.push(r.label);
      working = strip(working, r.test);
      break;
    }
  }

  // --- genres ---
  const genreIds: number[] = [];
  if (/\b(sci[-\s]?fi|science\s+fiction)\b/i.test(working)) {
    const id = mediaType === "tv" ? SCIFI.tv : SCIFI.movie;
    genreIds.push(id);
    summary.push(SCIFI.label);
    working = strip(working, /\b(sci[-\s]?fi|science\s+fiction)\b/);
  }
  for (const [word, g] of Object.entries(GENRES)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(working)) {
      const id = mediaType === "tv" ? g.tv : g.movie;
      if (id != null && !genreIds.includes(id)) {
        genreIds.push(id);
        summary.push(g.label);
      }
      working = strip(working, new RegExp(`\\b${word}\\b`));
    }
  }

  // --- leftover descriptive words ---
  const leftover = working
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));

  const isCatalog =
    (yearGte != null || genreIds.length > 0 || hasReputation) && leftover.length <= 1;

  // Keep Documentary (99) + Music (10402) out of acclaim-ranked lists unless the
  // user asked for them — otherwise concert films/docs top a "cult classics" list.
  const excludeGenreIds =
    genreIds.includes(99) || genreIds.includes(10402) ? [] : [99, 10402];

  return {
    mediaType,
    detectedMedia,
    yearGte,
    yearLte,
    genreIds,
    excludeGenreIds,
    sort,
    voteFloor,
    voteCeil,
    isCatalog,
    summary: summary.join(" · "),
  };
}
