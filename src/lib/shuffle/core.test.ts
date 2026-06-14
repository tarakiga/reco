import { sample, buildDiscoverParams, mapProviders, selectedProviders } from "./core";

test("sample returns at most n distinct members of the array", () => {
  const out = sample([1, 2, 3, 4, 5], 3);
  expect(out).toHaveLength(3);
  expect(new Set(out).size).toBe(3);
  out.forEach((x) => expect([1, 2, 3, 4, 5]).toContain(x));
  expect(sample([1, 2], 5)).toHaveLength(2); // n larger than array
});

test("buildDiscoverParams ORs services + genres and asks for subscription titles", () => {
  const p = buildDiscoverParams({ region: "US", services: [8, 337], genres: [28, 878], page: 3 });
  expect(p.watch_region).toBe("US");
  expect(p.with_watch_providers).toBe("8|337");
  expect(p.with_watch_monetization_types).toBe("flatrate");
  expect(p.with_genres).toBe("28|878");
  expect(p.page).toBe("3");
  // omit empty filters
  const q = buildDiscoverParams({ region: "GB", services: [], genres: [], page: 1 });
  expect(q.with_watch_providers).toBeUndefined();
  expect(q.with_genres).toBeUndefined();
});

test("mapProviders sorts by region display priority and caps", () => {
  const out = mapProviders(
    [
      { provider_id: 2, provider_name: "B", logo_path: "/b.jpg", display_priorities: { US: 5 } },
      { provider_id: 1, provider_name: "A", logo_path: "/a.jpg", display_priorities: { US: 1 } },
    ],
    "US",
    1,
  );
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ id: 1, name: "A" });
  expect(out[0].logoUrl).toContain("/a.jpg");
});

test("selectedProviders keeps only flatrate providers in the chosen services", () => {
  const watch = { results: { US: { flatrate: [
    { provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg" },
    { provider_id: 9, provider_name: "Prime", logo_path: "/p.jpg" },
  ] } } };
  const out = selectedProviders(watch, "US", [8]);
  expect(out.map((p) => p.name)).toEqual(["Netflix"]);
});
