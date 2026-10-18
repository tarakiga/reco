import { describe, test, expect } from "vitest";
import { nextUnwatched, watchKey, watchProgressSummary } from "./watch-progress";

const seasons = [
  { seasonNumber: 1, episodeCount: 3 },
  { seasonNumber: 2, episodeCount: 2 },
];
const set = (...pairs: [number, number][]) => new Set(pairs.map(([s, e]) => watchKey(s, e)));

test("an empty set starts at the beginning", () => {
  expect(nextUnwatched(set(), seasons)).toEqual({ season: 1, episode: 1 });
});

test("a mid-season gap is the next episode", () => {
  expect(nextUnwatched(set([1, 1], [1, 3]), seasons)).toEqual({ season: 1, episode: 2 });
});

test("a finished season rolls into the next", () => {
  expect(nextUnwatched(set([1, 1], [1, 2], [1, 3]), seasons)).toEqual({ season: 2, episode: 1 });
});

test("everything watched returns null", () => {
  expect(nextUnwatched(set([1, 1], [1, 2], [1, 3], [2, 1], [2, 2]), seasons)).toBeNull();
});

test("specials are ignored on both sides", () => {
  const withSpecials = [{ seasonNumber: 0, episodeCount: 5 }, ...seasons];
  expect(nextUnwatched(set([0, 1]), withSpecials)).toEqual({ season: 1, episode: 1 });
});

test("seasons arriving out of order are walked in order", () => {
  // Season 1 must still hold an unwatched episode: with it fully watched, scan
  // order never matters and this test would pass even without the sort.
  expect(nextUnwatched(set([1, 1]), [...seasons].reverse())).toEqual({ season: 1, episode: 2 });
});

describe("watchProgressSummary", () => {
  const two = [
    { seasonNumber: 1, episodeCount: 2 },
    { seasonNumber: 2, episodeCount: 3 },
  ];

  test("nothing watched is null", () => {
    expect(watchProgressSummary([], two)).toBeNull();
  });

  test("counts watched episodes against every real episode", () => {
    expect(watchProgressSummary([{ season: 1, episode: 1 }], two)).toEqual({
      counted: 1,
      total: 5,
      pct: 20,
      next: { season: 1, episode: 2 },
    });
  });

  test("a watch on a since-removed episode is not counted", () => {
    const s = watchProgressSummary(
      [
        { season: 1, episode: 1 },
        { season: 1, episode: 9 },
      ],
      two,
    );
    expect(s?.counted).toBe(1);
    expect(s?.pct).toBe(20);
  });

  test("specials are excluded from the total", () => {
    const s = watchProgressSummary([{ season: 1, episode: 1 }], [{ seasonNumber: 0, episodeCount: 4 }, ...two]);
    expect(s?.total).toBe(5);
  });
});
