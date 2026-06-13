import { vi, beforeEach, afterAll } from "vitest";
import { db } from "@/db";
import { titles, people } from "@/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/tmdb/client", () => ({
  tmdb: {
    getTitle: vi.fn(),
    getPerson: vi.fn(),
  },
  TmdbError: class TmdbError extends Error {},
}));

import { tmdb } from "@/lib/tmdb/client";
import { getOrCreateTitle, getOrCreatePerson } from "./catalog";

const TMDB_ID = 99900001;
const PERSON_ID = 99900002;

async function cleanup() {
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_ID));
  await db.delete(people).where(eq(people.tmdbId, PERSON_ID));
}
beforeEach(cleanup);
afterAll(cleanup);

test("getOrCreateTitle mirrors a TMDB title on first view", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tmdb.getTitle as any).mockResolvedValue({
    id: TMDB_ID,
    title: "Test Movie",
    overview: "x",
    poster_path: "/p.jpg",
    backdrop_path: "/b.jpg",
    release_date: "2021-09-01",
    genres: [{ id: 1, name: "Action" }],
    credits: { cast: [{ id: 5, name: "Actor", character: "Hero", order: 0 }] },
  });
  const t = await getOrCreateTitle("movie", TMDB_ID);
  expect(t.title).toBe("Test Movie");
  expect(t.slug).toBe("test-movie-2021");
  expect(t.releaseYear).toBe(2021);
  const rows = await db.select().from(titles).where(eq(titles.tmdbId, TMDB_ID));
  expect(rows).toHaveLength(1);
});

test("getOrCreateTitle returns cached row without re-fetching when fresh", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tmdb.getTitle as any).mockResolvedValue({ id: TMDB_ID, title: "Test Movie", release_date: "2021-01-01" });
  await getOrCreateTitle("movie", TMDB_ID);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tmdb.getTitle as any).mockClear();
  await getOrCreateTitle("movie", TMDB_ID);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((tmdb.getTitle as any).mock.calls.length).toBe(0);
});

test("getOrCreatePerson mirrors a person", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tmdb.getPerson as any).mockResolvedValue({
    id: PERSON_ID,
    name: "Jane Doe",
    profile_path: "/j.jpg",
    biography: "bio",
  });
  const p = await getOrCreatePerson(PERSON_ID);
  expect(p.name).toBe("Jane Doe");
  expect(p.slug).toBe("jane-doe");
});
