import { posterUrl, backdropUrl, profileUrl } from "./images";

test("builds poster url with default size", () => {
  expect(posterUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w500/abc.jpg");
});
test("builds backdrop url", () => {
  expect(backdropUrl("/b.jpg")).toBe("https://image.tmdb.org/t/p/w1280/b.jpg");
});
test("builds profile url", () => {
  expect(profileUrl("/p.jpg")).toBe("https://image.tmdb.org/t/p/w185/p.jpg");
});
test("returns null for null path", () => {
  expect(posterUrl(null)).toBeNull();
  expect(profileUrl(undefined)).toBeNull();
});
