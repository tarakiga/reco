import {
  parseIdSlug,
  pickTrailerKey,
  topCast,
  keyCrew,
  certification,
  recommendations,
  formatRuntime,
  formatMoney,
  formatBinge,
  titleFacts,
} from "./detail";
import type { TmdbTitleDetail } from "./types";

test("parseIdSlug extracts leading integer id", () => {
  expect(parseIdSlug("603-the-matrix-1999")).toBe(603);
  expect(parseIdSlug("42")).toBe(42);
  expect(parseIdSlug("not-a-number")).toBeNull();
});

test("pickTrailerKey prefers official YouTube Trailer", () => {
  const key = pickTrailerKey([
    { key: "aaa", site: "YouTube", type: "Teaser", official: true },
    { key: "bbb", site: "YouTube", type: "Trailer", official: true },
    { key: "ccc", site: "Vimeo", type: "Trailer", official: true },
  ]);
  expect(key).toBe("bbb");
});

test("pickTrailerKey returns null when no youtube video", () => {
  expect(pickTrailerKey([{ key: "x", site: "Vimeo", type: "Trailer" }])).toBeNull();
  expect(pickTrailerKey(undefined)).toBeNull();
});

test("topCast maps and limits", () => {
  const cast = topCast(
    [
      { id: 1, name: "A", character: "X", order: 0, profile_path: "/a.jpg" },
      { id: 2, name: "B", character: "Y", order: 1, profile_path: null },
    ],
    1,
  );
  expect(cast).toHaveLength(1);
  expect(cast[0]).toMatchObject({ tmdbId: 1, name: "A", character: "X" });
  expect(cast[0].href).toBe("/person/1-a");
});

test("keyCrew returns director + writers for movies, deduped", () => {
  const meta: TmdbTitleDetail = {
    id: 1,
    credits: {
      crew: [
        { id: 1, name: "Nolan", job: "Director", department: "Directing" },
        { id: 1, name: "Nolan", job: "Writer", department: "Writing" },
        { id: 2, name: "Bird", job: "Screenplay", department: "Writing" },
      ],
    },
  };
  const crew = keyCrew(meta, "movie");
  expect(crew).toEqual([
    { role: "Director", names: ["Nolan"] },
    { role: "Writers", names: ["Nolan", "Bird"] },
  ]);
});

test("keyCrew uses created_by for TV", () => {
  const meta: TmdbTitleDetail = { id: 1, created_by: [{ id: 9, name: "Gilligan" }] };
  expect(keyCrew(meta, "tv")).toEqual([{ role: "Creator", names: ["Gilligan"] }]);
});

test("certification reads US movie rating and TV rating", () => {
  const movie: TmdbTitleDetail = {
    id: 1,
    release_dates: {
      results: [
        { iso_3166_1: "GB", release_dates: [{ certification: "15" }] },
        { iso_3166_1: "US", release_dates: [{ certification: "" }, { certification: "R" }] },
      ],
    },
  };
  expect(certification(movie, "movie")).toBe("R");
  const tv: TmdbTitleDetail = {
    id: 1,
    content_ratings: { results: [{ iso_3166_1: "US", rating: "TV-MA" }] },
  };
  expect(certification(tv, "tv")).toBe("TV-MA");
  expect(certification({ id: 1 }, "movie")).toBeNull();
});

test("recommendations maps movie/tv items and skips people", () => {
  const meta: TmdbTitleDetail = {
    id: 1,
    recommendations: {
      results: [
        { id: 5, media_type: "movie", title: "Dunkirk", release_date: "2017-07-21" },
        { id: 6, media_type: "person", name: "Someone" },
      ],
    },
  };
  const recs = recommendations(meta);
  expect(recs).toHaveLength(1);
  expect(recs[0]).toMatchObject({ tmdbId: 5, title: "Dunkirk", year: 2017 });
  expect(recs[0].href).toBe("/title/movie/5-dunkirk-2017");
});

test("formatRuntime and formatMoney", () => {
  expect(formatRuntime(180)).toBe("3h");
  expect(formatRuntime(138)).toBe("2h 18m");
  expect(formatRuntime(45)).toBe("45m");
  expect(formatRuntime(0)).toBeNull();
  expect(formatMoney(100000000)).toBe("$100,000,000");
  expect(formatMoney(0)).toBeNull();
});

test("titleFacts returns money for movies and counts for TV", () => {
  const movie: TmdbTitleDetail = {
    id: 1,
    status: "Released",
    original_language: "en",
    budget: 100000000,
    revenue: 976000000,
  };
  expect(titleFacts(movie, "movie")).toEqual([
    { label: "Status", value: "Released" },
    { label: "Original language", value: "English" },
    { label: "Budget", value: "$100,000,000" },
    { label: "Revenue", value: "$976,000,000", tone: "money" },
  ]);
  const tv: TmdbTitleDetail = {
    id: 1,
    status: "Returning Series",
    number_of_seasons: 5,
    number_of_episodes: 62,
    networks: [{ id: 1, name: "AMC" }],
  };
  const facts = titleFacts(tv, "tv");
  expect(facts).toContainEqual({ label: "Seasons", value: "5" });
  expect(facts).toContainEqual({ label: "Episodes", value: "62" });
  expect(facts).toContainEqual({ label: "Network", value: "AMC" });
  // no episode_run_time on this fixture → no binge row
  expect(facts.some((f) => f.label === "Binge watch")).toBe(false);
});

test("titleFacts attaches the network logo when present", () => {
  const tv: TmdbTitleDetail = {
    id: 1,
    networks: [{ id: 1, name: "HBO", logo_path: "/hbo.png" }],
  };
  expect(titleFacts(tv, "tv")).toContainEqual({
    label: "Network",
    value: "HBO",
    imageUrl: "https://image.tmdb.org/t/p/w92/hbo.png",
  });
});

test("formatBinge renders days/hours/minutes compactly", () => {
  expect(formatBinge(2914)).toBe("2d 1h"); // 62 eps x 47m, rounds to 49h
  expect(formatBinge(2880)).toBe("2d"); // exactly 48h → drop 0h
  expect(formatBinge(480)).toBe("8h");
  expect(formatBinge(45)).toBe("45m");
  expect(formatBinge(0)).toBeNull();
  expect(formatBinge(undefined)).toBeNull();
});

test("titleFacts adds a Binge watch row for TV when runtime is known", () => {
  const tv: TmdbTitleDetail = {
    id: 1,
    number_of_seasons: 5,
    number_of_episodes: 62,
    episode_run_time: [47],
  };
  const facts = titleFacts(tv, "tv");
  expect(facts).toContainEqual({ label: "Binge watch", value: "2d 1h" });
  // it sits after Episodes
  const labels = facts.map((f) => f.label);
  expect(labels.indexOf("Binge watch")).toBe(labels.indexOf("Episodes") + 1);
});

test("titleFacts falls back to last/next episode runtime when episode_run_time is empty", () => {
  const tv: TmdbTitleDetail = {
    id: 1,
    number_of_episodes: 62,
    episode_run_time: [], // TMDB increasingly returns this empty
    last_episode_to_air: { runtime: 56 },
  };
  // 62 x 56 = 3472m → round(57.9h) = 58h → 2d 10h
  expect(titleFacts(tv, "tv")).toContainEqual({ label: "Binge watch", value: "2d 10h" });
});
