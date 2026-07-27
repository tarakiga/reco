import { test, expect } from "vitest";
import { toMoodCard } from "./mood-card";

test("maps a movie brief to a card", () => {
  const c = toMoodCard("movie", 19, {
    title: "Metropolis",
    release_date: "1927-01-10",
    poster_path: "/p.jpg",
  });
  expect(c).toMatchObject({ mediaType: "movie", tmdbId: 19, title: "Metropolis", year: 1927 });
  expect(c!.href).toBe("/title/movie/19-metropolis-1927");
});

test("maps a TV brief using name and first_air_date", () => {
  const c = toMoodCard("tv", 1396, {
    name: "Breaking Bad",
    first_air_date: "2008-01-20",
    poster_path: null,
  });
  expect(c).toMatchObject({ mediaType: "tv", tmdbId: 1396, title: "Breaking Bad", year: 2008 });
  expect(c!.href.startsWith("/title/tv/1396-")).toBe(true);
});

test("returns null for a missing brief", () => {
  expect(toMoodCard("tv", 1, null)).toBeNull();
});

test("tolerates a brief with no date", () => {
  const c = toMoodCard("tv", 2, { name: "X", poster_path: null });
  expect(c!.year).toBeNull();
});
