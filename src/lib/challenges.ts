// Curated "challenges" — watch-the-whole-set goals, defined as TMDB discover
// queries (verified company ids) so the lists stay current without hardcoded ids.

export interface Challenge {
  slug: string;
  name: string;
  emoji: string;
  blurb: string;
  /** TMDB Discover (movie) params. */
  discover: Record<string, string>;
}

export const CHALLENGES: Challenge[] = [
  {
    slug: "studio-ghibli",
    name: "Studio Ghibli",
    emoji: "🌿",
    blurb: "Every feature from the legendary Japanese animation house.",
    discover: { with_companies: "10342", sort_by: "primary_release_date.asc" },
  },
  {
    slug: "a24",
    name: "A24 essentials",
    emoji: "🎟️",
    blurb: "The acclaimed indie distributor's most-loved films.",
    discover: { with_companies: "41077", sort_by: "vote_count.desc", "vote_count.gte": "200" },
  },
  {
    slug: "pixar",
    name: "Pixar",
    emoji: "💡",
    blurb: "Pixar's feature filmography, oldest first.",
    discover: { with_companies: "3", sort_by: "primary_release_date.asc" },
  },
  {
    slug: "disney-animation",
    name: "Disney Animation",
    emoji: "🏰",
    blurb: "Walt Disney's animated feature canon, from Snow White onward.",
    // Disney's animation arm was renamed across eras, so the catalogue is split
    // over three company ids: Walt Disney Animation Studios (6125, modern), Walt
    // Disney Feature Animation (171656, the 80s–2000s renaissance), and Walt
    // Disney Productions (3166, the classics). OR them, keep to animated features
    // (genre 16, runtime >= 70) and filter out shorts/obscurities by vote count.
    discover: {
      with_companies: "6125|171656|3166",
      with_genres: "16",
      with_original_language: "en",
      "with_runtime.gte": "70",
      "vote_count.gte": "400",
      sort_by: "primary_release_date.asc",
    },
  },
  {
    slug: "dreamworks",
    name: "DreamWorks Animation",
    emoji: "🐉",
    blurb: "Shrek, How to Train Your Dragon, Kung Fu Panda and the rest.",
    discover: { with_companies: "521", sort_by: "vote_count.desc", "vote_count.gte": "100" },
  },
];

export const getChallenge = (slug: string): Challenge | undefined => CHALLENGES.find((c) => c.slug === slug);
