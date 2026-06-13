import { filmography } from "./person";

test("maps combined credits to title results, newest first, movie/tv only", () => {
  const out = filmography({
    cast: [
      { id: 1, media_type: "movie", title: "Old", release_date: "1999-01-01", poster_path: "/o.jpg", character: "A" },
      { id: 2, media_type: "tv", name: "New Show", first_air_date: "2022-01-01", poster_path: "/n.jpg", character: "B" },
      { id: 3, media_type: "person" as never, name: "ignored" },
      { id: 1, media_type: "movie", title: "Old", release_date: "1999-01-01" }, // dup id
    ],
  });
  expect(out.map((t) => t.tmdbId)).toEqual([2, 1]); // newest first, deduped
  expect(out[0].href).toBe("/title/tv/2-new-show-2022");
});

test("handles missing credits", () => {
  expect(filmography(undefined)).toEqual([]);
  expect(filmography({})).toEqual([]);
});
