import { sample, buildDiscoverParams, mapProviders, selectedProviders } from "./core";

test("sample returns at most n distinct members of the array", () => {
  const out = sample([1, 2, 3, 4, 5], 3);
  expect(out).toHaveLength(3);
  expect(new Set(out).size).toBe(3);
  out.forEach((x) => expect([1, 2, 3, 4, 5]).toContain(x));
  expect(sample([1, 2], 5)).toHaveLength(2); // n larger than array
});

test("buildDiscoverParams ORs services + genres and includes free/ad titles", () => {
  const p = buildDiscoverParams({ region: "US", services: [8, 337], genres: [28, 878], page: 3 });
  expect(p.watch_region).toBe("US");
  expect(p.with_watch_providers).toBe("8|337");
  expect(p.with_watch_monetization_types).toBe("flatrate|free|ads");
  expect(p.with_genres).toBe("28|878");
  expect(p.page).toBe("3");
  // omit empty filters
  const q = buildDiscoverParams({ region: "GB", services: [], genres: [], page: 1 });
  expect(q.with_watch_providers).toBeUndefined();
  expect(q.with_genres).toBeUndefined();
});

test("mapProviders keeps the top by priority PLUS low-ranked free services", () => {
  const out = mapProviders(
    [
      { provider_id: 2, provider_name: "B", logo_path: "/b.jpg", display_priorities: { US: 5 } },
      { provider_id: 1, provider_name: "A", logo_path: "/a.jpg", display_priorities: { US: 1 } },
      { provider_id: 73, provider_name: "Tubi TV", logo_path: "/t.jpg", display_priorities: { US: 277 } },
    ],
    "US",
    1, // cap excludes everything but the top 1 by priority...
  );
  expect(out.map((p) => p.name)).toEqual(["A", "Tubi TV"]); // ...but Tubi is added back as a free service
});

test("selectedProviders includes flatrate + free + ads in the chosen services, deduped", () => {
  const watch = { results: { US: {
    flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg" }],
    free: [{ provider_id: 73, provider_name: "Tubi", logo_path: "/t.jpg" }],
    ads: [{ provider_id: 73, provider_name: "Tubi", logo_path: "/t.jpg" }], // duplicate across ads+free
  } } };
  const out = selectedProviders(watch, "US", [8, 73]);
  expect(out.map((p) => p.name)).toEqual(["Netflix", "Tubi"]); // deduped
  expect(selectedProviders(watch, "US", [8]).map((p) => p.name)).toEqual(["Netflix"]); // only chosen
});
