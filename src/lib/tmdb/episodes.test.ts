import { seasonSummaries, toEpisodes, searchEpisodes, rankTopEpisodes, type EpisodeIndexEntry } from "./episodes";
import type { TmdbTitleDetail, TmdbSeasonDetail } from "./types";

const entry = (over: Partial<EpisodeIndexEntry>): EpisodeIndexEntry => ({
  seasonNumber: 1,
  episodeNumber: 1,
  name: "",
  overview: "",
  runtime: null,
  airDate: null,
  stillUrl: null,
  voteAverage: null,
  voteCount: null,
  cast: [],
  guestStars: [],
  characters: [],
  crew: [],
  ...over,
});

test("seasonSummaries hides specials, sorts, and maps", () => {
  const meta: TmdbTitleDetail = {
    id: 1,
    seasons: [
      { id: 9, season_number: 0, name: "Specials", episode_count: 8 },
      { id: 2, season_number: 2, name: "Season 2", episode_count: 13, air_date: "2009-03-08" },
      { id: 1, season_number: 1, name: "Season 1", episode_count: 7, air_date: "2008-01-20", poster_path: "/s1.jpg" },
    ],
  };
  const out = seasonSummaries(meta);
  expect(out.map((s) => s.seasonNumber)).toEqual([1, 2]); // no season 0, sorted
  expect(out[0]).toEqual({
    seasonNumber: 1,
    name: "Season 1",
    episodeCount: 7,
    year: 2008,
    posterUrl: "https://image.tmdb.org/t/p/w500/s1.jpg",
  });
});

test("seasonSummaries returns [] when no seasons", () => {
  expect(seasonSummaries({ id: 1 })).toEqual([]);
});

test("toEpisodes maps fields and builds still url", () => {
  const season: TmdbSeasonDetail = {
    id: 1,
    season_number: 1,
    episodes: [
      {
        id: 11,
        episode_number: 1,
        name: "Pilot",
        overview: "Walter cooks.",
        runtime: 58,
        air_date: "2008-01-20",
        still_path: "/still.jpg",
        vote_average: 8.2,
        vote_count: 1500,
      },
      {
        id: 12,
        episode_number: 2,
        name: "",
        vote_average: 0,
        guest_stars: [{ id: 7, name: "Brad Pitt", character: "Will", profile_path: "/bp.jpg" }],
      },
    ],
  };
  const eps = toEpisodes(season);
  expect(eps[0]).toEqual({
    episodeNumber: 1,
    name: "Pilot",
    overview: "Walter cooks.",
    runtime: 58,
    airDate: "2008-01-20",
    stillUrl: "https://image.tmdb.org/t/p/w300/still.jpg",
    voteAverage: 8.2,
    voteCount: 1500,
    cast: [],
  });
  // empty name → fallback; 0 vote → null; missing fields → null; guest → cast
  expect(eps[1]).toEqual({
    episodeNumber: 2,
    name: "Episode 2",
    overview: "",
    runtime: null,
    airDate: null,
    stillUrl: null,
    voteAverage: null,
    voteCount: null,
    cast: [
      {
        id: 7,
        name: "Brad Pitt",
        character: "Will",
        profileUrl: "https://image.tmdb.org/t/p/w185/bp.jpg",
        href: "/person/7-brad-pitt",
      },
    ],
  });
});

test("searchEpisodes finds an episode by guest star not in the overview", () => {
  const entries = [
    entry({ seasonNumber: 8, episodeNumber: 9, name: "The One with the Rumor", overview: "Monica hosts Thanksgiving.", guestStars: ["Brad Pitt"] }),
    entry({ seasonNumber: 1, episodeNumber: 1, name: "The Pilot", overview: "Rachel arrives." }),
  ];
  const res = searchEpisodes(entries, "brad pitt");
  expect(res).toHaveLength(1);
  expect(res[0].episodeNumber).toBe(9);
  expect(res[0].matchedOn).toBe("Guest: Brad Pitt");
});

test("searchEpisodes ignores filler words in natural phrasing", () => {
  const entries = [
    entry({ seasonNumber: 8, episodeNumber: 9, name: "The One with the Rumor", overview: "Monica hosts Thanksgiving.", guestStars: ["Brad Pitt"] }),
    entry({ seasonNumber: 1, episodeNumber: 1, name: "The Pilot", overview: "Rachel arrives." }),
  ];
  const res = searchEpisodes(entries, "the episode with brad pitt");
  expect(res).toHaveLength(1);
  expect(res[0].episodeNumber).toBe(9);
  expect(res[0].matchedOn).toBe("Guest: Brad Pitt");
});

test("searchEpisodes finds an episode by the character a guest played", () => {
  const entries = [
    entry({ seasonNumber: 3, episodeNumber: 19, name: "Knight in Retreat", overview: "Michael poses as a scientist.", guestStars: ["Ann Turkel"], characters: ["Bianca Morgan"] }),
    entry({ seasonNumber: 1, episodeNumber: 1, name: "Knight of the Phoenix", overview: "Origin." }),
  ];
  const res = searchEpisodes(entries, "bianca");
  expect(res).toHaveLength(1);
  expect(res[0].episodeNumber).toBe(19);
  expect(res[0].matchedOn).toBe("As Bianca Morgan");
});

test("searchEpisodes matches title/overview and ranks title hits first", () => {
  const entries = [
    entry({ episodeNumber: 1, name: "Thanksgiving leftovers", overview: "nothing" }),
    entry({ episodeNumber: 2, name: "The Pilot", overview: "A big thanksgiving dinner." }),
  ];
  const res = searchEpisodes(entries, "thanksgiving");
  expect(res.map((r) => r.episodeNumber)).toEqual([1, 2]); // title hit ranks above overview hit
  expect(res[0].matchedOn).toBeNull(); // not a person match
});

test("searchEpisodes requires all words and ignores too-short queries", () => {
  const entries = [entry({ guestStars: ["Brad Pitt"] }), entry({ episodeNumber: 2, overview: "pitt stop" })];
  expect(searchEpisodes(entries, "brad pitt").every((r) => r.guestStars.includes("Brad Pitt"))).toBe(true);
  expect(searchEpisodes(entries, "x")).toEqual([]);
});

test("rankTopEpisodes gates out a low-sample 10.0 and drops unrated episodes", () => {
  const entries = [
    entry({ seasonNumber: 5, episodeNumber: 14, name: "Ozymandias", voteAverage: 9.4, voteCount: 5000 }),
    entry({ seasonNumber: 3, episodeNumber: 9, name: "Obscure", voteAverage: 10, voteCount: 2 }),
    entry({ seasonNumber: 1, episodeNumber: 1, name: "Pilot", voteAverage: 8.2, voteCount: 3000 }),
    entry({ seasonNumber: 2, episodeNumber: 4, name: "Unrated", voteAverage: null, voteCount: null }),
  ];
  const top = rankTopEpisodes(entries, 10);
  expect(top.map((e) => e.name)).toEqual(["Ozymandias", "Pilot"]); // 2-vote fluke gated out, unrated dropped
});

test("rankTopEpisodes falls back to all rated when none clear the vote gate", () => {
  const entries = [
    entry({ episodeNumber: 1, name: "A", voteAverage: 7.5, voteCount: 3 }),
    entry({ episodeNumber: 2, name: "B", voteAverage: 8.9, voteCount: 4 }),
  ];
  // median vote count 3 → gate floored at 5, nothing qualifies → rank all rated.
  expect(rankTopEpisodes(entries, 10).map((e) => e.name)).toEqual(["B", "A"]);
});

test("rankTopEpisodes returns [] when no episode has a rating", () => {
  expect(rankTopEpisodes([entry({ voteAverage: null }), entry({ voteAverage: 7, voteCount: 0 })])).toEqual([]);
});

test("searchEpisodes matches a bare episode number across seasons", () => {
  const entries = [
    entry({ seasonNumber: 1, episodeNumber: 1, name: "Pilot" }),
    entry({ seasonNumber: 1, episodeNumber: 2, name: "Second" }),
    entry({ seasonNumber: 2, episodeNumber: 1, name: "The Return" }),
  ];
  const res = searchEpisodes(entries, "1");
  expect(res.map((e) => `${e.seasonNumber}:${e.episodeNumber}`)).toEqual(["1:1", "2:1"]);
});

test("searchEpisodes reads 101 as season 1 episode 1", () => {
  const entries = [
    entry({ seasonNumber: 1, episodeNumber: 1, name: "Pilot" }),
    entry({ seasonNumber: 10, episodeNumber: 1, name: "Tenth Opener" }),
  ];
  const res = searchEpisodes(entries, "101");
  expect(res[0].seasonNumber).toBe(1);
  expect(res[0].episodeNumber).toBe(1);
});

test("searchEpisodes accepts s2e3, S2 E3 and 2x03 forms", () => {
  const entries = [
    entry({ seasonNumber: 2, episodeNumber: 3, name: "Target" }),
    entry({ seasonNumber: 3, episodeNumber: 2, name: "Decoy" }),
  ];
  expect(searchEpisodes(entries, "s2e3")[0]?.name).toBe("Target");
  expect(searchEpisodes(entries, "S2 E3")[0]?.name).toBe("Target");
  expect(searchEpisodes(entries, "2x03")[0]?.name).toBe("Target");
});

test("searchEpisodes puts positional hits ahead of text hits for a numeric query", () => {
  const entries = [
    entry({ seasonNumber: 1, episodeNumber: 1, name: "Pilot" }),
    entry({ seasonNumber: 5, episodeNumber: 9, name: "Room 101", overview: "A door marked 101." }),
  ];
  const res = searchEpisodes(entries, "101");
  expect(res[0].episodeNumber).toBe(1);
  expect(res.some((e) => e.name === "Room 101")).toBe(true);
});

test("searchEpisodes still returns nothing for a short non-numeric query", () => {
  const entries = [entry({ seasonNumber: 1, episodeNumber: 1, name: "Pilot" })];
  expect(searchEpisodes(entries, "p")).toEqual([]);
});
