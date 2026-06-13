import { cosineSimilarity, matchPercent } from "./match";

test("cosineSimilarity of identical vectors is 1", () => {
  expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 5);
  expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
});

test("matchPercent ramps cos 0.2->0 and 0.8->100, clamped", () => {
  expect(matchPercent(0.2)).toBe(0);
  expect(matchPercent(0.8)).toBe(100);
  expect(matchPercent(0.5)).toBe(50);
  expect(matchPercent(-0.3)).toBe(0);
  expect(matchPercent(0.95)).toBe(100);
});
