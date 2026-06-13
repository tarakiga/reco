import { toSearchResults } from "./transform";

test("maps movie/tv/person items with hrefs and drops unknown types", () => {
  const out = toSearchResults([
    { id: 603, media_type: "movie", title: "The Matrix", release_date: "1999-03-31", poster_path: "/m.jpg" },
    { id: 1399, media_type: "tv", name: "Thrones", first_air_date: "2011-04-17", poster_path: "/t.jpg" },
    { id: 6384, media_type: "person", name: "Keanu Reeves", profile_path: "/k.jpg" },
    { id: 1, media_type: "collection" as never, name: "ignored" },
  ]);
  expect(out).toHaveLength(3);
  const movie = out.find((r) => r.kind === "title" && r.title === "The Matrix")!;
  expect(movie.href).toBe("/title/movie/603-the-matrix-1999");
  const tv = out.find((r) => r.kind === "title" && r.title === "Thrones")!;
  expect(tv.href).toBe("/title/tv/1399-thrones-2011");
  const person = out.find((r) => r.kind === "person")!;
  expect(person.href).toBe("/person/6384-keanu-reeves");
});
