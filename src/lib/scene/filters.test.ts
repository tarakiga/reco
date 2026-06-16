import { parseQueryFilters } from "./filters";

test("'cult classics from the 80s' → catalog, 1980s, rating-sorted", () => {
  const f = parseQueryFilters("cult classics from the 80s");
  expect(f.isCatalog).toBe(true);
  expect(f.yearGte).toBe(1980);
  expect(f.yearLte).toBe(1989);
  expect(f.sort).toBe("vote_average.desc");
  expect(f.summary).toContain("1980s");
});

test("'best 90s sci-fi movies' → catalog, 1990s, sci-fi genre, movie", () => {
  const f = parseQueryFilters("best 90s sci-fi movies");
  expect(f.isCatalog).toBe(true);
  expect(f.yearGte).toBe(1990);
  expect(f.genreIds).toContain(878);
  expect(f.mediaType).toBe("movie");
});

test("'underrated horror' → catalog with a vote ceiling", () => {
  const f = parseQueryFilters("underrated horror");
  expect(f.isCatalog).toBe(true);
  expect(f.genreIds).toContain(27);
  expect(f.voteCeil).not.toBeNull();
});

test("decade word + tv genre maps to the TV id", () => {
  const f = parseQueryFilters("eighties sitcoms");
  expect(f.mediaType).toBe("tv");
  expect(f.yearGte).toBe(1980);
});

test("a descriptive scene query is NOT treated as catalog", () => {
  const f = parseQueryFilters("a giant squid attacks a cruise ship");
  expect(f.isCatalog).toBe(false);
});

test("a plain title is NOT catalog", () => {
  expect(parseQueryFilters("the matrix").isCatalog).toBe(false);
});
