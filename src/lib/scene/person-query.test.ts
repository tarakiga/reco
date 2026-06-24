import { parsePersonQuery } from "./person-query";

test("plain 'by <full name>' → adaptive person query (movie)", () => {
  const pq = parsePersonQuery("movies by harlen coben");
  expect(pq).toEqual({ name: "harlen coben", role: null, mediaType: "movie" });
});

test("'created by' on a show → creator role, tv media", () => {
  const pq = parsePersonQuery("tv shows created by vince gilligan");
  expect(pq).toEqual({ name: "vince gilligan", role: "creator", mediaType: "tv" });
});

test("'directed by' → directing role", () => {
  const pq = parsePersonQuery("films directed by christopher nolan");
  expect(pq?.role).toBe("directing");
  expect(pq?.name).toBe("christopher nolan");
  expect(pq?.mediaType).toBe("movie");
});

test("'starring' → acting role", () => {
  const pq = parsePersonQuery("movies starring tom hanks");
  expect(pq).toEqual({ name: "tom hanks", role: "acting", mediaType: "movie" });
});

test("'based on the books by' → writing role", () => {
  const pq = parsePersonQuery("based on the books by stephen king");
  expect(pq?.role).toBe("writing");
  expect(pq?.name).toBe("stephen king");
});

// --- must NOT be treated as person queries (scene descriptions) ---

test("'with' is never a person hint", () => {
  expect(parsePersonQuery("a movie with a giant squid")).toBeNull();
});

test("bare 'by <single common noun>' is rejected", () => {
  expect(parsePersonQuery("a man stands by a river")).toBeNull();
});

test("'from <single word>' is rejected", () => {
  expect(parsePersonQuery("scenes from a marriage")).toBeNull();
});

test("a plain scene description has no connector", () => {
  expect(parsePersonQuery("a giant squid attacks a cruise ship")).toBeNull();
});
