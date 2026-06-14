import { afterAll, beforeAll } from "vitest";
import { db } from "@/db";
import { profiles, titles } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  setWatchStatus,
  removeFromWatchlist,
  listWatchlist,
  setRating,
  removeRating,
  getTitleState,
  addFavourite,
  removeFavourite,
  listFavourites,
  updateProfile,
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
  expect(state).toEqual({ status: "watching", score: 5, favourite: false });
});

test("remove clears watchlist and rating", async () => {
  await removeFromWatchlist(userId, titleId);
  await removeRating(userId, titleId);
  const state = await getTitleState(userId, titleId);
  expect(state).toEqual({ status: null, score: null, favourite: false });
  expect(await listWatchlist(userId)).toHaveLength(0);
});

test("favourites: add is idempotent, list returns it, getTitleState reflects it", async () => {
  await addFavourite(userId, titleId);
  await addFavourite(userId, titleId); // idempotent — no duplicate / no throw
  const list = await listFavourites(userId);
  expect(list).toHaveLength(1);
  expect(list[0].title).toBe("UC Test");
  expect((await getTitleState(userId, titleId)).favourite).toBe(true);
});

test("removeFavourite clears it", async () => {
  await removeFavourite(userId, titleId);
  expect(await listFavourites(userId)).toHaveLength(0);
  expect((await getTitleState(userId, titleId)).favourite).toBe(false);
});

test("updateProfile writes only provided fields", async () => {
  await updateProfile(userId, { region: "GB", preferredGenres: [28, 35] });
  const [p1] = await db.select().from(profiles).where(eq(profiles.id, userId));
  expect(p1.region).toBe("GB");
  expect(p1.preferredGenres).toEqual([28, 35]);

  await updateProfile(userId, { preferredGenres: [18] }); // region untouched
  const [p2] = await db.select().from(profiles).where(eq(profiles.id, userId));
  expect(p2.region).toBe("GB");
  expect(p2.preferredGenres).toEqual([18]);
});
