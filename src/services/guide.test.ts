import { test, expect } from "vitest";
import { withEpisodeAnchor, findBroadcast, type GuideChannel } from "./guide";

test("appends the episode deep-link anchor for a TV title page", () => {
  expect(withEpisodeAnchor("/title/tv/168-are-you-being-served", 3, 5)).toBe(
    "/title/tv/168-are-you-being-served#s3e5",
  );
});

test("does not anchor movie pages or the search fallback", () => {
  expect(withEpisodeAnchor("/title/movie/603-the-matrix", 1, 1)).toBe("/title/movie/603-the-matrix");
  expect(withEpisodeAnchor("/search?q=Are%20You%20Being%20Served", 3, 5)).toBe(
    "/search?q=Are%20You%20Being%20Served",
  );
});

test("does not anchor when season or episode is missing", () => {
  expect(withEpisodeAnchor("/title/tv/168-show", null, 5)).toBe("/title/tv/168-show");
  expect(withEpisodeAnchor("/title/tv/168-show", 3, null)).toBe("/title/tv/168-show");
  expect(withEpisodeAnchor("/title/tv/168-show", null, null)).toBe("/title/tv/168-show");
});

const entry = (href: string, time: string | null) => ({
  id: 1, time, airstamp: null, showName: "x", season: null, episode: null,
  episodeTitle: null, synopsis: null, runtime: null, href,
});
const guide: GuideChannel[] = [
  { channel: "BBC One", entries: [entry("/title/tv/999-other-show", "20:00")] },
  { channel: "Channel 4", entries: [entry("/title/tv/1396-breaking-bad#s3e5", "21:00")] },
];

test("finds the channel and time for a show by its tmdb id", () => {
  expect(findBroadcast(guide, 1396)).toEqual({ channel: "Channel 4", time: "21:00" });
});

test("does not match a different id sharing a prefix", () => {
  expect(findBroadcast(guide, 139)).toBeNull();
});

test("null when the show is not in the schedule", () => {
  expect(findBroadcast(guide, 42)).toBeNull();
});
