import { parseIdSlug, pickTrailerKey, topCast } from "./detail";

test("parseIdSlug extracts leading integer id", () => {
  expect(parseIdSlug("603-the-matrix-1999")).toBe(603);
  expect(parseIdSlug("42")).toBe(42);
  expect(parseIdSlug("not-a-number")).toBeNull();
});

test("pickTrailerKey prefers official YouTube Trailer", () => {
  const key = pickTrailerKey([
    { key: "aaa", site: "YouTube", type: "Teaser", official: true },
    { key: "bbb", site: "YouTube", type: "Trailer", official: true },
    { key: "ccc", site: "Vimeo", type: "Trailer", official: true },
  ]);
  expect(key).toBe("bbb");
});

test("pickTrailerKey returns null when no youtube video", () => {
  expect(pickTrailerKey([{ key: "x", site: "Vimeo", type: "Trailer" }])).toBeNull();
  expect(pickTrailerKey(undefined)).toBeNull();
});

test("topCast maps and limits", () => {
  const cast = topCast(
    [
      { id: 1, name: "A", character: "X", order: 0, profile_path: "/a.jpg" },
      { id: 2, name: "B", character: "Y", order: 1, profile_path: null },
    ],
    1,
  );
  expect(cast).toHaveLength(1);
  expect(cast[0]).toMatchObject({ tmdbId: 1, name: "A", character: "X" });
  expect(cast[0].href).toBe("/person/1-a");
});
