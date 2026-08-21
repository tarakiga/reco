import { vi, test, expect, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/tmdb/client", () => ({
  tmdb: { tvAiring: vi.fn() },
}));

import { tmdb } from "@/lib/tmdb/client";
import { tvAiringInfo, tvStatusBadges } from "./tv-status";

beforeEach(() => vi.clearAllMocks());

test("returns status, next episode and last air date from one call", async () => {
  (tmdb.tvAiring as Mock).mockResolvedValue({
    status: "Returning Series",
    last_air_date: "2026-08-13",
    next_episode_to_air: { season_number: 3, episode_number: 5, name: "The Heist", air_date: "2026-08-22" },
  });
  expect(await tvAiringInfo(1396)).toEqual({
    status: "Returning Series",
    lastAirDate: "2026-08-13",
    nextEpisode: { seasonNumber: 3, episodeNumber: 5, name: "The Heist", airDate: "2026-08-22" },
  });
});

test("a show with nothing scheduled has a null nextEpisode", async () => {
  (tmdb.tvAiring as Mock).mockResolvedValue({ status: "Ended", last_air_date: "2013-09-29" });
  expect(await tvAiringInfo(1396)).toEqual({ status: "Ended", lastAirDate: "2013-09-29", nextEpisode: null });
});

test("an upstream failure returns the all-null shape rather than throwing", async () => {
  (tmdb.tvAiring as Mock).mockRejectedValue(new Error("TMDB 502"));
  expect(await tvAiringInfo(1396)).toEqual({ status: null, lastAirDate: null, nextEpisode: null });
});

test("the badge path reads the same widened call", async () => {
  (tmdb.tvAiring as Mock).mockResolvedValue({ status: "Ended" });
  const map = await tvStatusBadges([{ mediaType: "tv", tmdbId: 1396 }]);
  expect(map.get(1396)).toEqual({ label: "Ended", tone: "neutral" });
  expect((tmdb.tvAiring as Mock).mock.calls.length).toBe(1);
});
