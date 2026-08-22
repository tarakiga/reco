import { vi, test, expect, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/wikidata", () => ({ sparql: vi.fn() }));
vi.mock("@/lib/tmdb/client", () => ({ tmdb: { externalIds: vi.fn() } }));

import { sparql } from "@/lib/wikidata";
import { tmdb } from "@/lib/tmdb/client";
import { titleExtras } from "./title-extras";

const row = (prop: string, qid: string, label: string) => ({
  prop: { value: prop },
  val: { value: `http://www.wikidata.org/entity/${qid}` },
  valLabel: { value: label },
});

beforeEach(() => {
  vi.clearAllMocks();
  (tmdb.externalIds as Mock).mockResolvedValue({ wikidata_id: "Q100" });
});

test("groups awards and locations from the bindings", async () => {
  (sparql as Mock).mockResolvedValue([
    row("award", "Q1", "Academy Award for Best Picture"),
    row("nominated", "Q2", "BAFTA"),
    row("filming", "Q3", "Lisbon"),
    row("setin", "Q4", "Mars"),
  ]);
  const out = await titleExtras("movie", 603);
  expect(out.awards).toMatchObject({ wins: 1, nominations: 1, oscars: 1 });
  expect(out.filmingLocations).toEqual([{ id: "Q3", label: "Lisbon" }]);
  expect(out.narrativeLocations).toEqual([{ id: "Q4", label: "Mars" }]);
});

test("a failed SPARQL call degrades to the empty shape", async () => {
  (sparql as Mock).mockResolvedValue(null);
  const out = await titleExtras("movie", 603);
  expect(out).toMatchObject({ awards: null, filmingLocations: [], narrativeLocations: [] });
});

test("a title with no wikidata id never queries SPARQL", async () => {
  (tmdb.externalIds as Mock).mockResolvedValue({ wikidata_id: null });
  const out = await titleExtras("movie", 603);
  expect(out.filmingLocations).toEqual([]);
  expect(sparql).not.toHaveBeenCalled();
});
