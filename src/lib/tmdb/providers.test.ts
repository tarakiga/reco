import { providersForRegion } from "./providers";

const watch = {
  results: {
    US: {
      link: "https://www.themoviedb.org/movie/603/watch?locale=US",
      flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg" }],
      rent: [{ provider_id: 2, provider_name: "Apple TV", logo_path: "/a.jpg" }],
    },
    GB: { flatrate: [{ provider_id: 9, provider_name: "Prime", logo_path: "/p.jpg" }] },
  },
};

test("returns grouped providers + link for a region", () => {
  const r = providersForRegion(watch, "US");
  expect(r).not.toBeNull();
  expect(r!.link).toContain("themoviedb.org");
  expect(r!.flatrate.map((p) => p.name)).toEqual(["Netflix"]);
  expect(r!.rent.map((p) => p.name)).toEqual(["Apple TV"]);
  expect(r!.buy).toEqual([]);
});

test("null when region absent", () => {
  expect(providersForRegion(watch, "NG")).toBeNull();
  expect(providersForRegion(undefined, "US")).toBeNull();
});
