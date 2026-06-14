import { vi, type Mock } from "vitest";

vi.mock("@/lib/tmdb/client", () => ({
  tmdb: { discover: vi.fn(), watchProviders: vi.fn(), getTitle: vi.fn() },
}));

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { titles } from "@/db/schema";
import { tmdb } from "@/lib/tmdb/client";
import { shuffle } from "./shuffle";

const IDS = [999200001, 999200002, 999200003];

beforeAll(async () => {
  for (const id of IDS) {
    await db.insert(titles).values({
      tmdbId: id, mediaType: "movie", slug: `__vitest__shuf_${id}`, title: `Shuf ${id}`,
      releaseYear: 2020, posterPath: "/p.jpg",
      metadata: {
        id, title: `Shuf ${id}`,
        "watch/providers": { results: { US: { flatrate: [
          { provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg" },
          { provider_id: 9, provider_name: "Prime", logo_path: "/p2.jpg" },
        ] } } },
      },
      refreshedAt: new Date(),
    });
  }
});
afterAll(async () => { await db.delete(titles).where(inArray(titles.tmdbId, IDS)); });

test("shuffle returns service-filtered, mirrored picks and sets broaden when thin", async () => {
  (tmdb.discover as Mock).mockResolvedValue({ results: IDS.map((id) => ({ id, media_type: "movie" })), total_pages: 1 });

  const res = await shuffle({ region: "US", services: [8], mediaType: "movie", genres: [], matchTaste: false, page: 1 });

  expect(res.picks.length).toBe(3);
  expect(res.picks.length).toBeLessThanOrEqual(5);
  expect(res.broaden).toBe(true); // fewer than 5 candidates
  expect(res.pickIds).toHaveLength(3);
  // providers limited to the chosen service (Netflix=8), not Prime=9
  expect(res.picks[0].providers.map((p) => p.name)).toEqual(["Netflix"]);
  expect(res.picks[0]).toHaveProperty("href");
  expect(res.picks[0].posterUrl).toContain("/p.jpg");
});
