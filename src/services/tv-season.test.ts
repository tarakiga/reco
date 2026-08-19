import { vi, type Mock } from "vitest";

vi.mock("@/lib/tmdb/client", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  tmdb: { season: vi.fn() },
}));

import { tmdb, TmdbError } from "@/lib/tmdb/client";
import { seasonEpisodes, oneEpisode } from "./tv-season";

const SEASON = {
  id: 1,
  season_number: 1,
  episodes: [
    {
      id: 11,
      episode_number: 1,
      name: "Pilot",
      overview: "First one.",
      air_date: "2008-01-20",
      runtime: 58,
      vote_average: 8.2,
      vote_count: 100,
      still_path: "/a.jpg",
    },
    {
      id: 12,
      episode_number: 2,
      name: "Cat's in the Bag...",
      overview: "Second one.",
      air_date: "2008-01-27",
      runtime: 48,
      vote_average: 8.1,
      vote_count: 90,
      still_path: null,
    },
  ],
};

test("maps a season into episode view models", async () => {
  (tmdb.season as Mock).mockResolvedValue(SEASON);
  const eps = await seasonEpisodes(1396, 1);
  expect(eps).toHaveLength(2);
  expect(eps![0]).toMatchObject({ episodeNumber: 1, name: "Pilot", runtime: 58, airDate: "2008-01-20" });
});

test("oneEpisode finds an episode by number", async () => {
  (tmdb.season as Mock).mockResolvedValue(SEASON);
  expect((await oneEpisode(1396, 1, 2))?.name).toBe("Cat's in the Bag...");
});

test("oneEpisode returns null when the number is not in the season", async () => {
  (tmdb.season as Mock).mockResolvedValue(SEASON);
  expect(await oneEpisode(1396, 1, 99)).toBeNull();
});

test("a failed season fetch propagates so an empty season is never cached", async () => {
  (tmdb.season as Mock).mockRejectedValue(new Error("TMDB 502"));
  await expect(seasonEpisodes(1396, 2)).rejects.toThrow("TMDB 502");
});

test("a 404 season is returned as null, not thrown", async () => {
  // Thrown errors do not keep their prototype across the "use cache" boundary,
  // so a 404 has to cross as a value or callers cannot recognise it.
  (tmdb.season as Mock).mockRejectedValue(new TmdbError(404, "TMDB /tv/1396/season/99 failed (404)"));
  await expect(seasonEpisodes(1396, 99)).resolves.toBeNull();
});

test("a 500 still throws so nothing is cached", async () => {
  (tmdb.season as Mock).mockRejectedValue(new TmdbError(500, "boom"));
  await expect(seasonEpisodes(1396, 3)).rejects.toThrow("boom");
});

test("oneEpisode returns null when the whole season is missing", async () => {
  (tmdb.season as Mock).mockRejectedValue(new TmdbError(404, "nope"));
  expect(await oneEpisode(1396, 99, 1)).toBeNull();
});
