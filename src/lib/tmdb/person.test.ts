import { filmography, personFacts, ageBetween } from "./person";

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

test("ageBetween computes whole years, accounting for month/day", () => {
  expect(ageBetween("1970-08-12", "2020-08-12")).toBe(50);
  expect(ageBetween("1970-08-12", "2020-08-11")).toBe(49); // day before birthday
  expect(ageBetween("bad", "2020-01-01")).toBeNull();
});

test("personFacts: deceased person shows born + died with age at death", () => {
  const facts = personFacts({
    known_for_department: "Acting",
    birthday: "1936-09-25",
    deathday: "2009-06-25",
    place_of_birth: "Chicago, Illinois, USA",
  });
  expect(facts).toEqual([
    { label: "Known for", value: "Acting" },
    { label: "Born", value: "September 25, 1936" },
    { label: "Died", value: "June 25, 2009 (age 72)" },
    { label: "Place of birth", value: "Chicago, Illinois, USA" },
  ]);
});

test("personFacts: living person shows age as of a fixed 'today'", () => {
  const facts = personFacts({ birthday: "1974-11-11" }, "2024-11-11");
  expect(facts).toEqual([{ label: "Born", value: "November 11, 1974 (age 50)" }]);
});

test("personFacts: empty when no data", () => {
  expect(personFacts({})).toEqual([]);
});
