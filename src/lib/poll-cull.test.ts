import { computeSurvivors, topTierGenres, OTHER_GENRE, type CullTitle } from "./poll-cull";

// Genre ids: 35 = Comedy, 27 = Horror, 18 = Drama, 878 = Sci-Fi.
const T = (id: string, title: string, genreIds: number[]): [string, CullTitle] => [id, { title, genreIds }];

const map = (...entries: [string, CullTitle][]) => new Map<string, CullTitle>(entries);
const votes = (...titleIds: string[]) => titleIds.map((titleId) => ({ titleId }));

test("the dominant genre's titles survive; others are culled", () => {
  const m = map(
    T("a", "Comedy A", [35]),
    T("b", "Comedy B", [35]),
    T("c", "Horror C", [27]),
  );
  // 3 picks: two comedies, one horror → comedy is the top tier.
  expect([...topTierGenres(votes("a", "b", "c"), m)]).toEqual([35]);
  expect(computeSurvivors(votes("a", "b", "c"), m).sort()).toEqual(["a", "b"]);
});

test("multi-genre titles survive if any genre is in the top tier", () => {
  const m = map(
    T("a", "Comedy", [35]),
    T("b", "Comedy-Drama", [35, 18]),
    T("c", "Pure Drama", [18]),
  );
  // genre counts: comedy 2, drama 2 → tie → both top tier → all survive.
  const top = topTierGenres(votes("a", "b", "c"), m);
  expect(top.has(35)).toBe(true);
  expect(top.has(18)).toBe(true);
  expect(computeSurvivors(votes("a", "b", "c"), m).sort()).toEqual(["a", "b", "c"]);
});

test("all distinct genres → no separation → nothing culled (runoff fallback)", () => {
  const m = map(T("a", "A", [35]), T("b", "B", [27]), T("c", "C", [18]));
  expect(computeSurvivors(votes("a", "b", "c"), m).sort()).toEqual(["a", "b", "c"]);
});

test("everyone picks the same movie → single survivor", () => {
  const m = map(T("a", "Dune", [878]));
  expect(computeSurvivors(votes("a", "a", "a"), m)).toEqual(["a"]);
});

test("titles with no genre data fall into the Other bucket", () => {
  const m = map(T("a", "No genres", []), T("b", "Also none", []), T("c", "Horror", [27]));
  // two genre-less picks → Other tier wins, horror is culled.
  expect([...topTierGenres(votes("a", "b", "c"), m)]).toEqual([OTHER_GENRE]);
  expect(computeSurvivors(votes("a", "b", "c"), m).sort()).toEqual(["a", "b"]);
});

test("survivors are ordered by vote count, then title", () => {
  const m = map(T("a", "Zebra Comedy", [35]), T("b", "Apple Comedy", [35]), T("c", "Mango Comedy", [35]));
  // b picked twice, a and c once each → b first, then by title (Mango < Zebra).
  expect(computeSurvivors(votes("a", "b", "b", "c"), m)).toEqual(["b", "c", "a"]);
});

test("no votes → no survivors", () => {
  expect(computeSurvivors([], map())).toEqual([]);
});
