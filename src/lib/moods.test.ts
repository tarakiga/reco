import { featuredMoods, PINNED_MOOD_SLUGS, hasTvTab, moodBlurb, type Mood } from "./moods";

test("pins the two fixed moods to the front, in order", () => {
  for (const [month, day] of [
    [1, 0],
    [6, 100],
    [10, 280],
    [12, 350],
  ] as const) {
    const slugs = featuredMoods(month, day).map((m) => m.slug);
    expect(slugs.slice(0, 2)).toEqual([...PINNED_MOOD_SLUGS]);
  }
});

test("returns four unique rails", () => {
  const slugs = featuredMoods(3, 42).map((m) => m.slug);
  expect(slugs).toHaveLength(4);
  expect(new Set(slugs).size).toBe(4);
});

test("fills a non-pinned slot with the in-season occasion", () => {
  expect(featuredMoods(10, 5).map((m) => m.slug)).toContain("spooky-season"); // October
  expect(featuredMoods(6, 5).map((m) => m.slug)).toContain("summer-blockbusters"); // June
  expect(featuredMoods(12, 5).map((m) => m.slug)).toContain("festive-favourites"); // December
});

test("backfills with evergreen moods when nothing is in season", () => {
  // March has no occasion — the two non-pinned slots are evergreen moods,
  // never occasions.
  const moods = featuredMoods(3, 7);
  for (const m of moods.slice(2)) expect(m.kind).toBe("mood");
});

test("is deterministic for the same date", () => {
  expect(featuredMoods(5, 130)).toEqual(featuredMoods(5, 130));
});

const base: Mood = {
  slug: "x",
  label: "X",
  emoji: "x",
  blurb: "movie blurb",
  kind: "mood",
};

test("hasTvTab is false when there is no TV list", () => {
  expect(hasTvTab(base)).toBe(false);
  expect(hasTvTab({ ...base, manualTv: [] })).toBe(false);
});

test("hasTvTab is true when a TV list is present", () => {
  expect(hasTvTab({ ...base, manualTv: [1, 2] })).toBe(true);
});

test("moodBlurb falls back to the shared blurb for TV", () => {
  expect(moodBlurb(base, "tv")).toBe("movie blurb");
});

test("moodBlurb prefers blurbTv for TV only", () => {
  const m = { ...base, blurbTv: "tv blurb" };
  expect(moodBlurb(m, "tv")).toBe("tv blurb");
  expect(moodBlurb(m, "movie")).toBe("movie blurb");
});
