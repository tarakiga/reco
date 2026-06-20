import { upcomingLabel, shiftYmd, estimatedVodYmd, VOD_WINDOW_DAYS } from "./release";

const NOW = new Date(2026, 5, 16); // 2026-06-16

test("returns a label for a future release date", () => {
  expect(upcomingLabel("2026-08-15", NOW)).toBe("Aug 15, 2026");
});

test("returns null for a past release date", () => {
  expect(upcomingLabel("2024-01-01", NOW)).toBeNull();
});

test("returns null for today (already released)", () => {
  expect(upcomingLabel("2026-06-16", NOW)).toBeNull();
});

test("returns a label for tomorrow", () => {
  expect(upcomingLabel("2026-06-17", NOW)).toBe("Jun 17, 2026");
});

test("handles full ISO timestamps (uses the date part)", () => {
  expect(upcomingLabel("2026-12-25T00:00:00.000Z", NOW)).toBe("Dec 25, 2026");
});

test("returns null for empty/invalid input", () => {
  expect(upcomingLabel(null, NOW)).toBeNull();
  expect(upcomingLabel(undefined, NOW)).toBeNull();
  expect(upcomingLabel("", NOW)).toBeNull();
  expect(upcomingLabel("not-a-date", NOW)).toBeNull();
});

test("shiftYmd moves a date forward and back across month/year boundaries", () => {
  expect(shiftYmd("2026-06-05", 18)).toBe("2026-06-23");
  expect(shiftYmd("2026-06-20", -18)).toBe("2026-06-02");
  expect(shiftYmd("2026-12-25", 10)).toBe("2027-01-04");
  expect(shiftYmd("2026-06-05T00:00:00.000Z", 18)).toBe("2026-06-23"); // tolerates ISO timestamps
});

test("estimatedVodYmd adds the standard cinema-to-VOD window", () => {
  expect(VOD_WINDOW_DAYS).toBe(18);
  expect(estimatedVodYmd("2026-06-05")).toBe("2026-06-23"); // matches the Carolina Caroline case
});
