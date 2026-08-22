import { vi, test, expect, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/wikidata", () => ({ sparql: vi.fn() }));
vi.mock("@/lib/tmdb/client", () => ({ tmdb: { titleBrief: vi.fn() } }));

import { sparql } from "@/lib/wikidata";
import { tmdb } from "@/lib/tmdb/client";
import { titlesByLocation } from "./wikidata-listing";

const binding = (tmdbId: number, mt: string, label = "Portugal") => ({
  tmdb: { value: String(tmdbId) },
  mt: { value: mt },
  srcLabel: { value: label },
});

beforeEach(() => vi.clearAllMocks());

test("maps bindings into title cards with the place heading", async () => {
  (sparql as Mock).mockResolvedValue([binding(603, "movie"), binding(1396, "tv")]);
  (tmdb.titleBrief as Mock).mockImplementation(async (mt: string, id: number) =>
    id === 603
      ? { title: "The Matrix", release_date: "1999-03-31", poster_path: "/m.jpg" }
      : { name: "Breaking Bad", first_air_date: "2008-01-20", poster_path: "/b.jpg" },
  );
  const out = await titlesByLocation("Q45");
  expect(out.heading).toBe("Portugal");
  expect(out.items.map((i) => i.title)).toEqual(["The Matrix", "Breaking Bad"]);
});

test("a failed SPARQL call degrades to an empty listing", async () => {
  (sparql as Mock).mockResolvedValue(null);
  expect(await titlesByLocation("Q45")).toEqual({ heading: "", items: [] });
});

test("an invalid qid never reaches Wikidata", async () => {
  expect(await titlesByLocation("not-a-qid")).toEqual({ heading: "", items: [] });
  expect(sparql).not.toHaveBeenCalled();
});

test("duplicate tmdb ids collapse to one card", async () => {
  (sparql as Mock).mockResolvedValue([binding(603, "movie"), binding(603, "movie")]);
  (tmdb.titleBrief as Mock).mockResolvedValue({ title: "The Matrix", release_date: "1999-03-31", poster_path: null });
  const out = await titlesByLocation("Q45");
  expect(out.items).toHaveLength(1);
});
