import { vi, test, expect, beforeEach, type Mock } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/tmdb/client", () => ({ tmdb: { getPerson: vi.fn(), collection: vi.fn() } }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import { cacheLife } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { personSets, collectionItems } from "./completion";

beforeEach(() => vi.clearAllMocks());

test("personSets caches real credits for days", async () => {
  (tmdb.getPerson as Mock).mockResolvedValue({
    combined_credits: {
      cast: [{ id: 603, media_type: "movie", title: "The Matrix", release_date: "1999-03-31", character: "Neo" }],
      crew: [],
    },
  });
  const out = await personSets(6384);
  expect(out.acted.map((i) => i.tmdbId)).toEqual([603]);
  expect(cacheLife).toHaveBeenCalledWith("days");
  expect(cacheLife).not.toHaveBeenCalledWith("hours");
});

test("personSets degrades a failed TMDB call to empty sets cached for hours", async () => {
  (tmdb.getPerson as Mock).mockRejectedValue(new Error("503"));
  expect(await personSets(6384)).toEqual({ acted: [], directed: [], wrote: [] });
  expect(cacheLife).toHaveBeenCalledWith("hours");
});

test("collectionItems degrades a failed TMDB call to an empty list cached for hours", async () => {
  (tmdb.collection as Mock).mockRejectedValue(new Error("503"));
  expect(await collectionItems(10)).toEqual([]);
  expect(cacheLife).toHaveBeenCalledWith("hours");
});
