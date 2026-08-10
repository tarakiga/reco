import { test, expect } from "vitest";
import { tmdbBriefToTitleResult } from "./brief";

test("maps a movie brief to a card", () => {
  const c = tmdbBriefToTitleResult("movie", 19, {
    title: "Metropolis",
    release_date: "1927-01-10",
    poster_path: "/p.jpg",
  });
  expect(c).toMatchObject({ mediaType: "movie", tmdbId: 19, title: "Metropolis", year: 1927 });
  expect(c!.href).toBe("/title/movie/19-metropolis-1927");
});

test("maps a TV brief using name and first_air_date", () => {
  const c = tmdbBriefToTitleResult("tv", 1396, {
    name: "Breaking Bad",
    first_air_date: "2008-01-20",
    poster_path: null,
  });
  expect(c).toMatchObject({ mediaType: "tv", tmdbId: 1396, title: "Breaking Bad", year: 2008 });
  expect(c!.href).toBe("/title/tv/1396-breaking-bad-2008");
});

test("returns null for a missing brief", () => {
  expect(tmdbBriefToTitleResult("tv", 1, null)).toBeNull();
});

test("tolerates a brief with no date", () => {
  const c = tmdbBriefToTitleResult("tv", 2, { name: "X", poster_path: null });
  expect(c!.year).toBeNull();
  expect(c!.releaseDate).toBeNull();
});

test("prefers title over name for a movie", () => {
  const c = tmdbBriefToTitleResult("movie", 1, {
    title: "The Preferred Title",
    name: "Ignored Name",
    poster_path: null,
  });
  expect(c!.title).toBe("The Preferred Title");
});

test("prefers name over title for a show", () => {
  const c = tmdbBriefToTitleResult("tv", 1, {
    title: "Ignored Title",
    name: "The Preferred Name",
    poster_path: null,
  });
  expect(c!.title).toBe("The Preferred Name");
});

test("treats an empty title as missing and falls back to name", () => {
  const c = tmdbBriefToTitleResult("movie", 2, {
    title: "",
    name: "Fallback",
    poster_path: null,
  });
  expect(c!.title).toBe("Fallback");
});

test("falls back to Untitled when the brief has no title at all", () => {
  const c = tmdbBriefToTitleResult("movie", 3, { poster_path: null });
  expect(c!.title).toBe("Untitled");
  expect(c!.href).toBe("/title/movie/3-untitled");
});

test("prefers the date field belonging to the media type", () => {
  const c = tmdbBriefToTitleResult("tv", 4, {
    name: "Show",
    release_date: "1990-01-01",
    first_air_date: "2001-05-05",
    poster_path: null,
  });
  expect(c!.releaseDate).toBe("2001-05-05");
  expect(c!.year).toBe(2001);
});

test("falls back to the other media type's date field", () => {
  const c = tmdbBriefToTitleResult("tv", 5, {
    name: "Show",
    release_date: "1990-01-01",
    poster_path: null,
  });
  expect(c!.year).toBe(1990);
});

test("drops adult titles", () => {
  expect(
    tmdbBriefToTitleResult("movie", 6, { title: "Adult", adult: true, poster_path: null }),
  ).toBeNull();
});

test("keeps titles explicitly flagged not adult", () => {
  const c = tmdbBriefToTitleResult("movie", 7, { title: "Fine", adult: false, poster_path: null });
  expect(c!.title).toBe("Fine");
});

test("builds a poster URL from the poster path", () => {
  const c = tmdbBriefToTitleResult("movie", 8, { title: "P", poster_path: "/x.jpg" });
  expect(c!.posterUrl).toBe("https://image.tmdb.org/t/p/w500/x.jpg");
});

test("keeps a malformed date out of the year and the slug", () => {
  const c = tmdbBriefToTitleResult("movie", 9, {
    title: "Broken",
    release_date: "abcd-01-01",
    poster_path: null,
  });
  expect(c!.year).toBeNull();
  expect(c!.releaseDate).toBe("abcd-01-01");
  expect(c!.href).toBe("/title/movie/9-broken");
});
