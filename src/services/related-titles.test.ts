import { vi, test, expect, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/wikidata", () => ({ sparql: vi.fn() }));
vi.mock("@/lib/tmdb/client", () => ({ tmdb: { externalIds: vi.fn(), titleBrief: vi.fn() } }));

import { sparql } from "@/lib/wikidata";
import { tmdb } from "@/lib/tmdb/client";
import { relatedTitles } from "./related-titles";

beforeEach(() => {
  vi.clearAllMocks();
  (tmdb.externalIds as Mock).mockResolvedValue({ wikidata_id: "Q100" });
});

test("maps related entries into labelled cards", async () => {
  (sparql as Mock).mockResolvedValue([{ tmdb: { value: "603" }, rel: { value: "remake" } }]);
  (tmdb.titleBrief as Mock).mockResolvedValue({ title: "The Matrix", release_date: "1999-03-31", poster_path: null });
  const out = await relatedTitles("movie", 550);
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ title: "The Matrix", relation: "Remake" });
});

test("a failed SPARQL call degrades to an empty list", async () => {
  (sparql as Mock).mockResolvedValue(null);
  expect(await relatedTitles("movie", 550)).toEqual([]);
});

test("a title with no wikidata id never queries SPARQL", async () => {
  (tmdb.externalIds as Mock).mockResolvedValue({ wikidata_id: null });
  expect(await relatedTitles("movie", 550)).toEqual([]);
  expect(sparql).not.toHaveBeenCalled();
});
