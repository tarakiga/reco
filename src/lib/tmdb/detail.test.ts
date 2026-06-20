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
  aggregateCast,
} from "./detail";
import type { TmdbTitleDetail } from "./types";

test("parseIdSlug extracts leading integer id", () => {
  expect(parseIdSlug("603-the-matrix-1999")).toBe(603);
  expect(parseIdSlug("42")).toBe(42);
  expect(parseIdSlug("not-a-number")).toBeNull();
});

test("aggregateCast orders by episode count and reads the first role's character", () => {
  const cast = aggregateCast([
    { id: 2, name: "Jill Marie Jones", order: 4, total_episode_count: 137, roles: [{ character: "Toni Childs-Garrett" }] },
    { id: 1, name: "Tracee Ellis Ross", order: 0, total_episode_count: 172, roles: [{ character: "Joan Clayton" }] },
  ]);
  expect(cast.map((c) => c.name)).toEqual(["Tracee Ellis Ross", "Jill Marie Jones"]);
  expect(cast[1]).toMatchObject({ tmdbId: 2, character: "Toni Childs-Garrett" });
  expect(cast[1].href).toBe("/person/2-jill-marie-jones");
});

test("aggregateCast ranks a high-episode recurring role above a low-episode guest with lower billing", () => {
  // Candy Davis (13 eps, order 558) should outrank a 2-episode guest billed at
  // order 8 — episode count is the significance signal, order only breaks ties.
  const cast = aggregateCast([
    { id: 1, name: "Low-ep Guest", order: 8, total_episode_count: 2, roles: [{ character: "Guest" }] },
    { id: 2, name: "Candy Davis", order: 558, total_episode_count: 13, roles: [{ character: "Miss Belfridge" }] },
  ]);
  expect(cast.map((c) => c.name)).toEqual(["Candy Davis", "Low-ep Guest"]);
});

test("aggregateCast uses billing order to break episode-count ties", () => {
  const cast = aggregateCast([
    { id: 1, name: "Second Billed", order: 3, total_episode_count: 20 },
    { id: 2, name: "First Billed", order: 1, total_episode_count: 20 },
  ]);
  expect(cast.map((c) => c.name)).toEqual(["First Billed", "Second Billed"]);
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
    { role: "Director", people: [{ id: 1, name: "Nolan", href: "/person/1-nolan" }] },
    {
      role: "Writers",
      people: [
        { id: 1, name: "Nolan", href: "/person/1-nolan" },
        { id: 2, name: "Bird", href: "/person/2-bird" },
      ],
    },
  ]);
});

test("keyCrew uses created_by for TV", () => {
  const meta: TmdbTitleDetail = { id: 1, created_by: [{ id: 9, name: "Gilligan" }] };
  expect(keyCrew(meta, "tv")).toEqual([
    { role: "Creator", people: [{ id: 9, name: "Gilligan", href: "/person/9-gilligan" }] },
  ]);
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

test("titleFacts adds cinema + VOD release dates for movies", () => {
  const movie: TmdbTitleDetail = {
    id: 1,
    release_dates: {
      results: [
        {
          iso_3166_1: "US",
          release_dates: [
            { type: 3, release_date: "2024-07-12T00:00:00.000Z" }, // theatrical
            { type: 4, release_date: "2024-09-20T00:00:00.000Z" }, // digital/VOD
          ],
        },
      ],
    },
  };
  const facts = titleFacts(movie, "movie");
  expect(facts).toContainEqual({ label: "In cinemas", value: "12 Jul 2024" });
  expect(facts).toContainEqual({ label: "VOD", value: "20 Sep 2024" });
});

test("titleFacts omits VOD when only a theatrical date exists (no today given)", () => {
  const movie: TmdbTitleDetail = {
    id: 1,
    release_dates: {
      results: [
        { iso_3166_1: "US", release_dates: [{ type: 2, release_date: "2024-01-05T00:00:00.000Z" }] },
      ],
    },
  };
  const facts = titleFacts(movie, "movie");
  expect(facts).toContainEqual({ label: "In cinemas", value: "5 Jan 2024" });
  expect(facts.some((f) => f.label === "VOD" || f.label === "Est. VOD")).toBe(false);
});

test("titleFacts estimates VOD (theatrical + 18d) when no digital date and film is recent", () => {
  const movie: TmdbTitleDetail = {
    id: 1,
    release_dates: {
      results: [
        { iso_3166_1: "US", release_dates: [{ type: 3, release_date: "2026-06-05T00:00:00.000Z" }] },
      ],
    },
  };
  const facts = titleFacts(movie, "movie", "2026-06-20");
  expect(facts).toContainEqual({ label: "In cinemas", value: "5 Jun 2026" });
  expect(facts).toContainEqual({ label: "Est. VOD", value: "23 Jun 2026" });
});

test("titleFacts does not estimate VOD for old catalogue titles", () => {
  const movie: TmdbTitleDetail = {
    id: 1,
    release_dates: {
      results: [
        { iso_3166_1: "US", release_dates: [{ type: 3, release_date: "1999-03-31T00:00:00.000Z" }] },
      ],
    },
  };
  const facts = titleFacts(movie, "movie", "2026-06-20");
  expect(facts).toContainEqual({ label: "In cinemas", value: "31 Mar 1999" });
  expect(facts.some((f) => f.label === "Est. VOD")).toBe(false);
});

test("titleFacts prefers a confirmed digital date over an estimate", () => {
  const movie: TmdbTitleDetail = {
    id: 1,
    release_dates: {
      results: [
        {
          iso_3166_1: "US",
          release_dates: [
            { type: 3, release_date: "2026-06-05T00:00:00.000Z" },
            { type: 4, release_date: "2026-07-01T00:00:00.000Z" },
          ],
        },
      ],
    },
  };
  const facts = titleFacts(movie, "movie", "2026-06-20");
  expect(facts).toContainEqual({ label: "VOD", value: "1 Jul 2026" });
  expect(facts.some((f) => f.label === "Est. VOD")).toBe(false);
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
