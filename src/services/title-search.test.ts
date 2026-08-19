import { vi, test, expect, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/tmdb/client", () => ({
  tmdb: { searchMulti: vi.fn() },
}));
vi.mock("@/lib/search/correct", () => ({
  correctTitleQuery: vi.fn(async () => null),
}));

import { tmdb } from "@/lib/tmdb/client";
import { correctTitleQuery } from "@/lib/search/correct";
import { searchWithCorrection } from "./title-search";

const HEAT = { id: 949, media_type: "movie", title: "Heat", release_date: "1995-12-15", poster_path: "/h.jpg" };

beforeEach(() => vi.clearAllMocks());

test("returns mapped results for a query with hits", async () => {
  (tmdb.searchMulti as Mock).mockResolvedValue({ results: [HEAT] });
  const out = await searchWithCorrection("heat");
  expect(out.results[0]).toMatchObject({ kind: "title", tmdbId: 949, title: "Heat" });
  expect(out.corrected).toBeNull();
});

test("falls back to the corrected spelling when the query finds nothing", async () => {
  (tmdb.searchMulti as Mock)
    .mockResolvedValueOnce({ results: [] })
    .mockResolvedValueOnce({ results: [HEAT] });
  (correctTitleQuery as Mock).mockResolvedValue("heat");
  const out = await searchWithCorrection("haet");
  expect(out.corrected).toBe("heat");
  expect(out.results[0]).toMatchObject({ kind: "title", title: "Heat" });
});

test("normalises whitespace and case before searching, so near-identical queries share work", async () => {
  (tmdb.searchMulti as Mock).mockResolvedValue({ results: [HEAT] });
  await searchWithCorrection("  Heat   1995 ");
  expect((tmdb.searchMulti as Mock).mock.calls[0][0]).toBe("heat 1995");
});

test("an empty query searches nothing", async () => {
  expect(await searchWithCorrection("   ")).toEqual({ results: [], corrected: null });
  expect(tmdb.searchMulti).not.toHaveBeenCalled();
});
