import { afterAll, beforeAll, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { profiles, titles, polls } from "@/db/schema";
import { createPoll, castVote, getPollState, listUserPolls, PollError } from "./polls";

const CLERK = "__vitest__clerk_polls";
// Two comedies and one horror, so the genre cull has something to separate.
const SEEDS = [
  { tmdbId: 99912001, title: "Poll Comedy A", genres: [{ id: 35, name: "Comedy" }] },
  { tmdbId: 99912002, title: "Poll Comedy B", genres: [{ id: 35, name: "Comedy" }] },
  { tmdbId: 99912003, title: "Poll Horror C", genres: [{ id: 27, name: "Horror" }] },
];
const IDS = SEEDS.map((s) => s.tmdbId);
let creatorId: string;

const voter = (n: string) => ({ userId: null, voterKey: `a:__vitest__${n}` });

beforeAll(async () => {
  await cleanup();
  const [p] = await db
    .insert(profiles)
    .values({ clerkUserId: CLERK, username: "__vitest__polls_user" })
    .returning();
  creatorId = p.id;
  for (const s of SEEDS) {
    await db.insert(titles).values({
      tmdbId: s.tmdbId,
      mediaType: "movie",
      slug: `poll-test-${s.tmdbId}`,
      title: s.title,
      releaseYear: 2020,
      posterPath: "/p.jpg",
      // refreshedAt now, so getOrCreateTitle serves the row without calling TMDB.
      refreshedAt: new Date(),
      metadata: { id: s.tmdbId, title: s.title, genres: s.genres, vote_average: 7 },
    });
  }
});

afterAll(cleanup);

async function cleanup() {
  const rows = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.clerkUserId, CLERK));
  for (const r of rows) await db.delete(polls).where(eq(polls.creatorId, r.id));
  await db.delete(profiles).where(eq(profiles.clerkUserId, CLERK));
  await db.delete(titles).where(inArray(titles.tmdbId, IDS));
}

test("round 1 records a vote and reports progress without revealing picks", async () => {
  const { slug } = await createPoll(creatorId, { title: "__vitest__ r1", expectedVoters: 3 });
  const state = await castVote(slug, voter("a"), "movie", 99912001);
  expect(state?.status).toBe("round1");
  expect(state?.votesIn).toBe(1);
  expect(state?.votesNeeded).toBe(3);
  expect(state?.myPick?.title).toBe("Poll Comedy A");
  // Blind round: nobody else's picks are exposed.
  expect(state?.reveal).toBeNull();
});

test("a voter changing their mind replaces their vote rather than adding one", async () => {
  const { slug } = await createPoll(creatorId, { title: "__vitest__ change", expectedVoters: 3 });
  await castVote(slug, voter("b"), "movie", 99912001);
  const state = await castVote(slug, voter("b"), "movie", 99912002);
  expect(state?.votesIn).toBe(1);
  expect(state?.myPick?.title).toBe("Poll Comedy B");
});

test("round 1 auto-advances and culls to the top genre tier when it fills", async () => {
  const { slug } = await createPoll(creatorId, { title: "__vitest__ cull", expectedVoters: 3 });
  await castVote(slug, voter("c1"), "movie", 99912001); // comedy
  await castVote(slug, voter("c2"), "movie", 99912002); // comedy
  const state = await castVote(slug, voter("c3"), "movie", 99912003); // horror, fills the poll

  expect(state?.status).toBe("round2");
  // Comedy has two picks to horror's one, so horror is culled.
  const survivors = (state?.round2 ?? []).map((o) => o.title).sort();
  expect(survivors).toEqual(["Poll Comedy A", "Poll Comedy B"]);
  expect(state?.reveal?.picks.length).toBe(3);
});

test("round 2 rejects a culled option and only round-1 voters may vote", async () => {
  const { slug } = await createPoll(creatorId, { title: "__vitest__ r2", expectedVoters: 3 });
  await castVote(slug, voter("d1"), "movie", 99912001);
  await castVote(slug, voter("d2"), "movie", 99912002);
  await castVote(slug, voter("d3"), "movie", 99912003);

  await expect(castVote(slug, voter("d1"), "movie", 99912003)).rejects.toBeInstanceOf(PollError);
  await expect(castVote(slug, voter("stranger"), "movie", 99912001)).rejects.toBeInstanceOf(PollError);
});

test("round 2 finishes and records a winner once every round-1 voter has voted again", async () => {
  const { slug } = await createPoll(creatorId, { title: "__vitest__ winner", expectedVoters: 3 });
  await castVote(slug, voter("e1"), "movie", 99912001);
  await castVote(slug, voter("e2"), "movie", 99912002);
  await castVote(slug, voter("e3"), "movie", 99912003);

  await castVote(slug, voter("e1"), "movie", 99912001);
  await castVote(slug, voter("e2"), "movie", 99912001);
  const state = await castVote(slug, voter("e3"), "movie", 99912002);

  expect(state?.status).toBe("done");
  expect(state?.winner?.title).toBe("Poll Comedy A");
});

test("a full round 1 refuses an extra voter", async () => {
  const { slug } = await createPoll(creatorId, { title: "__vitest__ full", expectedVoters: 2 });
  await castVote(slug, voter("f1"), "movie", 99912001);
  await castVote(slug, voter("f2"), "movie", 99912002);
  await expect(castVote(slug, voter("f3"), "movie", 99912001)).rejects.toBeInstanceOf(PollError);
});

test("getPollState returns null for an unknown slug", async () => {
  expect(await getPollState("__vitest__nope", null)).toBeNull();
});

test("listUserPolls surfaces the winner title once a poll finishes", async () => {
  const { slug } = await createPoll(creatorId, { title: "__vitest__ list", expectedVoters: 3 });
  await castVote(slug, voter("g1"), "movie", 99912001);
  await castVote(slug, voter("g2"), "movie", 99912002);
  await castVote(slug, voter("g3"), "movie", 99912003);

  await castVote(slug, voter("g1"), "movie", 99912001);
  await castVote(slug, voter("g2"), "movie", 99912001);
  await castVote(slug, voter("g3"), "movie", 99912002);

  const summaries = await listUserPolls(creatorId);
  const summary = summaries.find((s) => s.slug === slug);
  expect(summary?.status).toBe("done");
  expect(summary?.winnerTitle).toBe("Poll Comedy A");
});
