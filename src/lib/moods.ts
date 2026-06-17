// Curated mood & occasion definitions → TMDB Discover queries. Pure data so it
// can be unit-tested and reused by the service + pages. Genre/keyword ids are
// TMDB's stable ids. `withGenres`/`withKeywords` use "|" for OR.

export interface MoodQuery {
  withGenres?: string;
  withoutGenres?: string;
  withKeywords?: string;
  voteAverageGte?: number;
  voteCountGte?: number;
  sortBy?: string; // default popularity.desc
  mediaType?: "movie" | "tv"; // default movie
}

export interface Mood {
  slug: string;
  label: string;
  emoji: string;
  blurb: string;
  kind: "mood" | "occasion";
  query: MoodQuery;
  /** Months (1-12) an occasion is featured on the home page; omitted = evergreen. */
  season?: number[];
}

// Genre ids: Action 28 · Adventure 12 · Animation 16 · Comedy 35 · Crime 80
// Documentary 99 · Drama 18 · Family 10751 · Fantasy 14 · Horror 27
// Mystery 9648 · Romance 10749 · Sci-Fi 878 · Thriller 53
// Keyword ids: christmas 207317 · halloween 3335 · tearjerker 156924
// mind-bending 362567 · based-on-true-story 9672

export const MOODS: Mood[] = [
  {
    slug: "cosy-night-in",
    label: "Cosy night in",
    emoji: "🛋️",
    blurb: "Warm, comforting watches for a quiet evening.",
    kind: "mood",
    query: { withGenres: "35|10749|10751", withoutGenres: "27,53", voteAverageGte: 6.7, voteCountGte: 300 },
  },
  {
    slug: "edge-of-your-seat",
    label: "Edge of your seat",
    emoji: "😱",
    blurb: "Tense thrillers that won't let you breathe.",
    kind: "mood",
    query: { withGenres: "53|9648", voteCountGte: 600, sortBy: "vote_average.desc" },
  },
  {
    slug: "need-a-laugh",
    label: "Need a laugh",
    emoji: "😂",
    blurb: "Comedies to reset your mood.",
    kind: "mood",
    query: { withGenres: "35", withoutGenres: "27,53", voteAverageGte: 6.5, voteCountGte: 400 },
  },
  {
    slug: "a-good-cry",
    label: "A good cry",
    emoji: "😭",
    blurb: "Bring the tissues.",
    kind: "mood",
    query: { withGenres: "18|10749", withKeywords: "156924", voteAverageGte: 6.5, voteCountGte: 80 },
  },
  {
    slug: "mind-benders",
    label: "Mind-benders",
    emoji: "🤯",
    blurb: "Acclaimed sci-fi and mysteries that mess with your head.",
    kind: "mood",
    query: { withGenres: "878|9648", voteCountGte: 800, sortBy: "vote_average.desc" },
  },
  {
    slug: "date-night",
    label: "Date night",
    emoji: "❤️",
    blurb: "Crowd-pleasers for two.",
    kind: "mood",
    query: { withGenres: "10749|35", withoutGenres: "27,53", voteAverageGte: 6.5, voteCountGte: 400 },
  },
  {
    slug: "adrenaline-rush",
    label: "Adrenaline rush",
    emoji: "🔥",
    blurb: "High-octane action.",
    kind: "mood",
    query: { withGenres: "28|12", voteCountGte: 800, sortBy: "vote_average.desc" },
  },
  {
    slug: "epic-adventures",
    label: "Epic adventures",
    emoji: "🌌",
    blurb: "Sweeping, big-screen journeys.",
    kind: "mood",
    query: { withGenres: "12|14|878", voteCountGte: 1000 },
  },
  {
    slug: "family-movie-night",
    label: "Family movie night",
    emoji: "👨‍👩‍👧",
    blurb: "Something everyone can enjoy.",
    kind: "mood",
    query: { withGenres: "10751|16", voteAverageGte: 6.5, voteCountGte: 200 },
  },
  {
    slug: "true-stories",
    label: "Based on a true story",
    emoji: "🎬",
    blurb: "Real events, dramatised.",
    kind: "mood",
    query: { withKeywords: "9672", withoutGenres: "99", voteAverageGte: 6.8, voteCountGte: 300 },
  },
  // Occasions — only featured on the home page in their season.
  {
    slug: "spooky-season",
    label: "Spooky season",
    emoji: "🎃",
    blurb: "Horror and dread for the season.",
    kind: "occasion",
    season: [10],
    query: { withGenres: "27", voteCountGte: 300 },
  },
  {
    slug: "festive-favourites",
    label: "Festive favourites",
    emoji: "🎄",
    blurb: "Christmas movies to get cosy with.",
    kind: "occasion",
    season: [11, 12],
    query: { withKeywords: "207317", withGenres: "10751|35|10749", voteAverageGte: 6, voteCountGte: 40 },
  },
  {
    slug: "valentines-picks",
    label: "Valentine's picks",
    emoji: "💘",
    blurb: "Romance for the season of love.",
    kind: "occasion",
    season: [2],
    query: { withGenres: "10749", voteAverageGte: 6.8, voteCountGte: 400 },
  },
  {
    slug: "summer-blockbusters",
    label: "Summer blockbusters",
    emoji: "☀️",
    blurb: "Big, loud and fun.",
    kind: "occasion",
    season: [6, 7, 8],
    query: { withGenres: "28|12|878", voteCountGte: 1500 },
  },
];

export function getMoodBySlug(slug: string): Mood | undefined {
  return MOODS.find((m) => m.slug === slug);
}

/**
 * Home-page selection: any in-season occasions first, then a daily-rotating
 * slice of evergreen moods, capped at `count`. Deterministic given the date.
 */
export function featuredMoods(month: number, dayOfYear: number, count = 4): Mood[] {
  const occasions = MOODS.filter((m) => m.kind === "occasion" && m.season?.includes(month));
  const evergreen = MOODS.filter((m) => m.kind === "mood");
  const offset = ((dayOfYear % evergreen.length) + evergreen.length) % evergreen.length;
  const rotated = [...evergreen.slice(offset), ...evergreen.slice(0, offset)];
  return [...occasions, ...rotated].slice(0, count);
}
