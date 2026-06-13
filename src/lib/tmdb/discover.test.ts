import { toBrowseResults, buildDiscoverParams } from "./discover";

test("toBrowseResults injects mediaType and builds title hrefs", () => {
  const out = toBrowseResults("movie", [
    { id: 603, title: "The Matrix", release_date: "1999-03-31", poster_path: "/m.jpg" } as never,
  ]);
  expect(out[0]).toMatchObject({ kind: "title", mediaType: "movie", tmdbId: 603 });
  expect(out[0].href).toBe("/title/movie/603-the-matrix-1999");
});

test("buildDiscoverParams maps genre/year/sort, omitting blanks", () => {
  expect(buildDiscoverParams("movie", { genre: "28", year: "1999" })).toMatchObject({
    with_genres: "28",
    primary_release_year: "1999",
    sort_by: "popularity.desc",
    include_adult: "false",
  });
  const tv = buildDiscoverParams("tv", { year: "2011" });
  expect(tv.first_air_date_year).toBe("2011");
  expect(tv.with_genres).toBeUndefined();
});
