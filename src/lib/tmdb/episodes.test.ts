import { seasonSummaries, toEpisodes } from "./episodes";
import type { TmdbTitleDetail, TmdbSeasonDetail } from "./types";

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
      },
      { id: 12, episode_number: 2, name: "", vote_average: 0 },
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
  });
  // empty name → fallback; 0 vote → null; missing fields → null
  expect(eps[1]).toEqual({
    episodeNumber: 2,
    name: "Episode 2",
    overview: "",
    runtime: null,
    airDate: null,
    stillUrl: null,
    voteAverage: null,
  });
});
