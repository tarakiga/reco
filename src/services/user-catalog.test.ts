import { afterAll, beforeAll } from "vitest";
import { db } from "@/db";
import { profiles, titles, watchlistItems, ratings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  setWatchStatus,
  removeFromWatchlist,
  listWatchlist,
  setRating,
  removeRating,
  getTitleState,
} from "./user-catalog";

const CLERK = "__vitest__clerk_uc";
const TMDB_ID = 99911001;
let userId: string;
let titleId: string;

beforeAll(async () => {
  await cleanup();
  const [p] = await db.insert(profiles).values({ clerkUserId: CLERK, username: "__vitest__uc_user" }).returning();
  userId = p.id;
  const [t] = await db.insert(titles).values({
    tmdbId: TMDB_ID, mediaType: "movie", slug: "uc-test-2020", title: "UC Test", releaseYear: 2020,
  }).returning();
  titleId = t.id;
});
afterAll(cleanup);

async function cleanup() {
  await db.delete(profiles).where(eq(profiles.clerkUserId, CLERK));
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_ID));
}

test("setWatchStatus upserts and listWatchlist returns it", async () => {
  await setWatchStatus(userId, titleId, "want_to_watch");
  await setWatchStatus(userId, titleId, "watching");
  const list = await listWatchlist(userId);
  expect(list).toHaveLength(1);
  expect(list[0].status).toBe("watching");
  expect(list[0].title).toBe("UC Test");
});

test("setRating upserts; getTitleState returns status + score", async () => {
  await setRating(userId, titleId, 4);
  await setRating(userId, titleId, 5);
  const state = await getTitleState(userId, titleId);
  expect(state).toEqual({ status: "watching", score: 5 });
});

test("remove clears watchlist and rating", async () => {
  await removeFromWatchlist(userId, titleId);
  await removeRating(userId, titleId);
  const state = await getTitleState(userId, titleId);
  expect(state).toEqual({ status: null, score: null });
  expect(await listWatchlist(userId)).toHaveLength(0);
});
