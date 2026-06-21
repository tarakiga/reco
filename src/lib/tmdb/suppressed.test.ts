import { isSuppressedTitle } from "./suppressed";
import { toSearchResults } from "./transform";

test("flags the suppressed Night Manager duplicate, not the canonical show", () => {
  expect(isSuppressedTitle("tv", 324254)).toBe(true);
  expect(isSuppressedTitle("tv", 61859)).toBe(false); // canonical BBC series
  expect(isSuppressedTitle("movie", 324254)).toBe(false); // media type must match
});

test("toSearchResults drops a suppressed title but keeps the canonical one", () => {
  const results = toSearchResults([
    { id: 324254, media_type: "tv", name: "The Night Manager", first_air_date: "2017-01-05" },
    { id: 61859, media_type: "tv", name: "The Night Manager", first_air_date: "2016-02-21" },
  ]);
  expect(results.map((r) => r.tmdbId)).toEqual([61859]);
});
