import { test, expect } from "vitest";
import { episodeCardFields } from "./episode-card";

const BASE = {
  showYear: 2008,
  season: 1,
  episode: 1,
  airDate: "2008-01-20",
  overview: "A chemistry teacher gets a diagnosis.",
};

test("builds the season and episode meta line", () => {
  expect(episodeCardFields(BASE).metaLine).toBe("S1 - E1");
  expect(episodeCardFields({ ...BASE, season: 12, episode: 7 }).metaLine).toBe("S12 - E7");
});

test("prefers the episode air year over the show year", () => {
  expect(episodeCardFields({ ...BASE, airDate: "2011-07-17" }).year).toBe(2011);
});

test("falls back to the show year when there is no air date", () => {
  expect(episodeCardFields({ ...BASE, airDate: null }).year).toBe(2008);
});

test("falls back to the show year when the air date is malformed", () => {
  expect(episodeCardFields({ ...BASE, airDate: "abcd-01-01" }).year).toBe(2008);
});

test("returns a null year when neither is known", () => {
  expect(episodeCardFields({ ...BASE, airDate: null, showYear: null }).year).toBeNull();
});

test("passes a short synopsis through untouched", () => {
  expect(episodeCardFields(BASE).synopsis).toBe("A chemistry teacher gets a diagnosis.");
});

test("returns null rather than an empty synopsis", () => {
  expect(episodeCardFields({ ...BASE, overview: "   " }).synopsis).toBeNull();
});

test("clamps a long synopsis on a word boundary", () => {
  const long = `${"word ".repeat(80)}end`;
  const out = episodeCardFields({ ...BASE, overview: long }).synopsis!;
  expect(out.length).toBeLessThanOrEqual(244);
  expect(out.endsWith("...")).toBe(true);
  expect(out).not.toContain("wor...");
});

test("hard cuts when there is no space late enough to break on", () => {
  const out = episodeCardFields({ ...BASE, overview: "x".repeat(400) }).synopsis!;
  expect(out.endsWith("...")).toBe(true);
  expect(out.startsWith("x".repeat(240))).toBe(true);
});

test("never splits a multi code unit character", () => {
  const overview = `${"x".repeat(239)}\u{1F600}${"y".repeat(50)}`;
  const out = episodeCardFields({ ...BASE, overview }).synopsis!;
  // A lone surrogate makes the string invalid UTF-16. encodeURIComponent throws
  // on invalid UTF-16 (a lone surrogate) but accepts a string built only from
  // complete pairs, including an intact emoji, so this only fails on a real split.
  expect(() => encodeURIComponent(out)).not.toThrow();
});
