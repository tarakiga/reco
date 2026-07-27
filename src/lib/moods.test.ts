import { featuredMoods, PINNED_MOOD_SLUGS, hasTvTab, moodBlurb, MOODS, type Mood } from "./moods";

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

const withTv = MOODS.filter((m) => m.manualTv?.length);

test("21 of the 22 moods have a curated TV list", () => {
  expect(MOODS).toHaveLength(22);
  expect(withTv).toHaveLength(21);
});

test("festive-favourites has no TV list", () => {
  expect(MOODS.find((m) => m.slug === "festive-favourites")?.manualTv).toBeUndefined();
});

test("every TV list clears the one-row visual floor", () => {
  for (const m of withTv) expect(m.manualTv!.length).toBeGreaterThanOrEqual(6);
});

test("no TV list contains duplicate ids", () => {
  for (const m of withTv) {
    expect(new Set(m.manualTv!).size, `${m.slug} has duplicate ids`).toBe(m.manualTv!.length);
  }
});

// Guards the blurb-fallback trap: a mood whose shared blurb says "films" or
// "cinema" must override it for TV, or the TV tab describes the wrong medium.
test("no TV tab shows a movie-specific blurb", () => {
  const filmWords = /\b(films?|movies?|cinema|big-screen|blockbusters)\b/i;
  for (const m of withTv) {
    const shown = m.blurbTv ?? m.blurb;
    expect(filmWords.test(shown), `${m.slug} TV blurb says "${shown}"`).toBe(false);
  }
});
