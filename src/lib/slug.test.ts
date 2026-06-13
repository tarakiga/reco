import { slugify, titleSlug } from "./slug";

test("slugify lowercases, strips punctuation, hyphenates", () => {
  expect(slugify("The Matrix: Reloaded!")).toBe("the-matrix-reloaded");
});
test("slugify collapses whitespace and trims hyphens", () => {
  expect(slugify("  Spider-Man   No Way Home ")).toBe("spider-man-no-way-home");
});
test("titleSlug appends year when present", () => {
  expect(titleSlug("The Matrix", "1999-03-31")).toBe("the-matrix-1999");
});
test("titleSlug omits year when missing", () => {
  expect(titleSlug("Untitled", null)).toBe("untitled");
});
test("slugify handles empty to fallback", () => {
  expect(slugify("!!!")).toBe("untitled");
});
