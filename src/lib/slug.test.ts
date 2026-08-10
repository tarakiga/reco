import { slugify, titleSlug, yearFromDate } from "./slug";

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
test("titleSlug omits a year that is not four digits", () => {
  expect(titleSlug("Broken", "abcd-01-01")).toBe("broken");
  expect(titleSlug("Broken", "19")).toBe("broken");
});
test("titleSlug accepts a bare year", () => {
  expect(titleSlug("The Matrix", "1999")).toBe("the-matrix-1999");
});
test("slugify handles empty to fallback", () => {
  expect(slugify("!!!")).toBe("untitled");
});
test("yearFromDate parses the leading four digits", () => {
  expect(yearFromDate("1999-03-31")).toBe(1999);
  expect(yearFromDate("1999")).toBe(1999);
});
test("yearFromDate rejects missing or malformed dates", () => {
  expect(yearFromDate(null)).toBeNull();
  expect(yearFromDate(undefined)).toBeNull();
  expect(yearFromDate("")).toBeNull();
  expect(yearFromDate("abcd-01-01")).toBeNull();
  expect(yearFromDate("19")).toBeNull();
});
