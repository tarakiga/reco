import { buildTasteDescriptor, descriptorHash } from "./descriptor";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";

const meta: TmdbTitleDetail = {
  id: 1,
  title: "Arrival",
  release_date: "2016-11-11",
  original_language: "en",
  genres: [{ id: 18, name: "Drama" }, { id: 878, name: "Science Fiction" }],
  keywords: { keywords: [{ id: 1, name: "linguistics" }, { id: 2, name: "aliens" }] },
  credits: {
    cast: [{ id: 1, name: "Amy Adams", order: 0 }, { id: 2, name: "Jeremy Renner", order: 1 }],
    crew: [{ id: 9, name: "Denis Villeneuve", job: "Director", department: "Directing" }],
  },
};

test("buildTasteDescriptor includes title, decade, genres, keywords, cast, director", () => {
  const d = buildTasteDescriptor(meta, "movie");
  expect(d).toContain("Arrival");
  expect(d).toContain("2010s");
  expect(d).toContain("Science Fiction");
  expect(d).toContain("linguistics");
  expect(d).toContain("Amy Adams");
  expect(d).toContain("Denis Villeneuve");
});

test("descriptorHash is stable and content-sensitive", () => {
  const h1 = descriptorHash(buildTasteDescriptor(meta, "movie"));
  const h2 = descriptorHash(buildTasteDescriptor(meta, "movie"));
  expect(h1).toBe(h2);
  expect(h1).not.toBe(descriptorHash("other"));
});
