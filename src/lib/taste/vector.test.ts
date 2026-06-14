import { signalWeight, tasteCentroid } from "./vector";

test("signalWeight: ratings dominate, watchlist mild", () => {
  expect(signalWeight({ score: 5 })).toBe(1.0);
  expect(signalWeight({ score: 1 })).toBe(-1.0);
  expect(signalWeight({ score: 3 })).toBeCloseTo(0.1);
  expect(signalWeight({ status: "watched" })).toBe(0.3);
  expect(signalWeight({ status: "want_to_watch" })).toBe(0.15);
  // a score wins over status when both present
  expect(signalWeight({ score: 5, status: "watched" })).toBe(1.0);
});

test("tasteCentroid is the L2-normalized weighted sum", () => {
  const out = tasteCentroid([
    { weight: 1, embedding: [1, 0] },
    { weight: 1, embedding: [0, 1] },
  ])!;
  // (1,1) normalized
  expect(out[0]).toBeCloseTo(Math.SQRT1_2, 5);
  expect(out[1]).toBeCloseTo(Math.SQRT1_2, 5);
});

test("tasteCentroid pushes away from disliked", () => {
  const out = tasteCentroid([
    { weight: 1, embedding: [1, 0] },
    { weight: -1, embedding: [0, 1] },
  ])!;
  expect(out[0]).toBeGreaterThan(0);
  expect(out[1]).toBeLessThan(0);
});

test("tasteCentroid returns null for empty / zero vector", () => {
  expect(tasteCentroid([])).toBeNull();
});
