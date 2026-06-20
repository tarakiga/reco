import { withEpisodeAnchor } from "./guide";

test("appends the episode deep-link anchor for a TV title page", () => {
  expect(withEpisodeAnchor("/title/tv/168-are-you-being-served", 3, 5)).toBe(
    "/title/tv/168-are-you-being-served#s3e5",
  );
});

test("does not anchor movie pages or the search fallback", () => {
  expect(withEpisodeAnchor("/title/movie/603-the-matrix", 1, 1)).toBe("/title/movie/603-the-matrix");
  expect(withEpisodeAnchor("/search?q=Are%20You%20Being%20Served", 3, 5)).toBe(
    "/search?q=Are%20You%20Being%20Served",
  );
});

test("does not anchor when season or episode is missing", () => {
  expect(withEpisodeAnchor("/title/tv/168-show", null, 5)).toBe("/title/tv/168-show");
  expect(withEpisodeAnchor("/title/tv/168-show", 3, null)).toBe("/title/tv/168-show");
  expect(withEpisodeAnchor("/title/tv/168-show", null, null)).toBe("/title/tv/168-show");
});
