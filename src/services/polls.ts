import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { polls, pollVotes, titles } from "@/db/schema";
import { getOrCreateTitle } from "./catalog";
import { posterUrl } from "@/lib/tmdb/images";
import { computeSurvivors, topTierGenres, OTHER_GENRE } from "@/lib/poll-cull";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";

export class PollError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Title helpers
// ---------------------------------------------------------------------------

interface TitleLite {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  genreIds: number[];
  genres: { id: number; name: string }[];
  rating: number; // TMDB vote_average (0 when unknown) — round-2 tiebreak
}

async function loadTitles(ids: string[]): Promise<Map<string, TitleLite>> {
  const map = new Map<string, TitleLite>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      id: titles.id,
      tmdbId: titles.tmdbId,
      mediaType: titles.mediaType,
      title: titles.title,
      year: titles.releaseYear,
      posterPath: titles.posterPath,
      slug: titles.slug,
      metadata: titles.metadata,
    })
    .from(titles)
    .where(inArray(titles.id, ids));
  for (const r of rows) {
    const meta = (r.metadata ?? {}) as TmdbTitleDetail;
    const genres = (meta.genres ?? []).map((g) => ({ id: g.id, name: g.name }));
    map.set(r.id, {
      id: r.id,
      tmdbId: r.tmdbId,
      mediaType: r.mediaType,
      title: r.title,
      year: r.year,
      posterUrl: posterUrl(r.posterPath),
      href: `/title/${r.mediaType}/${r.tmdbId}-${r.slug}`,
      genreIds: genres.length ? genres.map((g) => g.id) : [OTHER_GENRE],
      genres,
      rating: typeof meta.vote_average === "number" ? meta.vote_average : 0,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Round logic
// ---------------------------------------------------------------------------

interface VoteLite {
  userId: string;
  titleId: string;
}

async function roundVotes(pollId: string, round: number): Promise<VoteLite[]> {
  return db
    .select({ userId: pollVotes.userId, titleId: pollVotes.titleId })
    .from(pollVotes)
    .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.round, round)));
}

function distinctVoters(votes: VoteLite[]): number {
  return new Set(votes.map((v) => v.userId)).size;
}

/** Close round 1: cull by genre, then either crown a sole survivor or open round 2. */
async function closeRound1(pollId: string): Promise<void> {
  const votes = await roundVotes(pollId, 1);
  const titleMap = await loadTitles(votes.map((v) => v.titleId));
  const survivors = computeSurvivors(votes, titleMap);
  if (survivors.length <= 1) {
    await db
      .update(polls)
      .set({ status: "done", round2TitleIds: survivors, winnerTitleId: survivors[0] ?? null })
      .where(eq(polls.id, pollId));
  } else {
    await db.update(polls).set({ status: "round2", round2TitleIds: survivors }).where(eq(polls.id, pollId));
  }
}

/** Close round 2: most-voted survivor wins (tie → higher TMDB rating, then title). */
async function closeRound2(pollId: string): Promise<void> {
  const votes = await roundVotes(pollId, 2);
  const titleMap = await loadTitles(votes.map((v) => v.titleId));
  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.titleId, (tally.get(v.titleId) ?? 0) + 1);
  let winner: string | null = null;
  let best = { votes: -1, rating: -1, title: "" };
  for (const [id, n] of tally) {
    const t = titleMap.get(id);
    const cand = { votes: n, rating: t?.rating ?? 0, title: t?.title ?? "" };
    if (
      cand.votes > best.votes ||
      (cand.votes === best.votes && cand.rating > best.rating) ||
      (cand.votes === best.votes && cand.rating === best.rating && cand.title.localeCompare(best.title) < 0)
    ) {
      best = cand;
      winner = id;
    }
  }
  await db.update(polls).set({ status: "done", winnerTitleId: winner }).where(eq(polls.id, pollId));
}

// ---------------------------------------------------------------------------
// Public API — creation & management
// ---------------------------------------------------------------------------

export async function createPoll(
  creatorId: string,
  input: { title: string; expectedVoters: number; deadline?: string | null },
): Promise<{ id: string; slug: string }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = randomBytes(5).toString("hex"); // 10 chars, unguessable
    try {
      const [row] = await db
        .insert(polls)
        .values({
          creatorId,
          slug,
          title: input.title,
          expectedVoters: input.expectedVoters,
          deadline: input.deadline ? new Date(input.deadline) : null,
        })
        .returning({ id: polls.id, slug: polls.slug });
      return row;
    } catch {
      // slug collision (astronomically rare) — retry with a fresh token
    }
  }
  throw new PollError(500, "Could not create the vote");
}

export interface PollSummary {
  id: string;
  slug: string;
  title: string;
  status: "round1" | "round2" | "done";
  expectedVoters: number;
  deadline: string | null;
  createdAt: string;
  round1Votes: number;
  winnerTitle: string | null;
}

export async function listUserPolls(userId: string): Promise<PollSummary[]> {
  const rows = await db
    .select()
    .from(polls)
    .where(eq(polls.creatorId, userId))
    .orderBy(desc(polls.createdAt));
  const winnerIds = rows.map((r) => r.winnerTitleId).filter((x): x is string => Boolean(x));
  const titleMap = await loadTitles(winnerIds);
  const summaries: PollSummary[] = [];
  for (const r of rows) {
    const votes = await roundVotes(r.id, 1);
    summaries.push({
      id: r.id,
      slug: r.slug,
      title: r.title,
      status: r.status,
      expectedVoters: r.expectedVoters,
      deadline: r.deadline ? r.deadline.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      round1Votes: distinctVoters(votes),
      winnerTitle: r.winnerTitleId ? titleMap.get(r.winnerTitleId)?.title ?? null : null,
    });
  }
  return summaries;
}

export async function deletePoll(userId: string, pollId: string): Promise<boolean> {
  const res = await db
    .delete(polls)
    .where(and(eq(polls.id, pollId), eq(polls.creatorId, userId)))
    .returning({ id: polls.id });
  return res.length > 0;
}

// ---------------------------------------------------------------------------
// Public API — voting & state
// ---------------------------------------------------------------------------

export async function castVote(
  slug: string,
  userId: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<PollViewState | null> {
  const [poll] = await db.select().from(polls).where(eq(polls.slug, slug));
  if (!poll) return null;
  if (poll.status === "done") throw new PollError(409, "Voting has ended");

  const round = poll.status === "round1" ? 1 : 2;
  const title = await getOrCreateTitle(mediaType, tmdbId);

  if (round === 1) {
    const votes = await roundVotes(poll.id, 1);
    const voters = new Set(votes.map((v) => v.userId));
    if (!voters.has(userId) && voters.size >= poll.expectedVoters) {
      throw new PollError(409, "This vote is already full");
    }
  } else {
    const [mine] = await db
      .select({ id: pollVotes.id })
      .from(pollVotes)
      .where(and(eq(pollVotes.pollId, poll.id), eq(pollVotes.userId, userId), eq(pollVotes.round, 1)));
    if (!mine) throw new PollError(403, "Only round-1 voters can vote in round 2");
    if (!(poll.round2TitleIds ?? []).includes(title.id)) {
      throw new PollError(409, "That option was eliminated in round 1");
    }
  }

  await db
    .insert(pollVotes)
    .values({ pollId: poll.id, userId, round, titleId: title.id })
    .onConflictDoUpdate({
      target: [pollVotes.pollId, pollVotes.userId, pollVotes.round],
      set: { titleId: title.id, createdAt: new Date() },
    });

  // Auto-advance when the round fills.
  if (round === 1) {
    const votes = await roundVotes(poll.id, 1);
    if (distinctVoters(votes) >= poll.expectedVoters) await closeRound1(poll.id);
  } else {
    const r1 = await roundVotes(poll.id, 1);
    const r2 = await roundVotes(poll.id, 2);
    if (distinctVoters(r2) >= distinctVoters(r1)) await closeRound2(poll.id);
  }

  return getPollState(slug, userId);
}

export async function closePoll(slug: string, userId: string): Promise<PollViewState | null> {
  const [poll] = await db.select().from(polls).where(eq(polls.slug, slug));
  if (!poll) return null;
  if (poll.creatorId !== userId) throw new PollError(403, "Only the creator can close this vote");
  if (poll.status === "done") throw new PollError(409, "This vote has already finished");
  if (poll.deadline && Date.now() <= poll.deadline.getTime()) {
    throw new PollError(409, "You can close it once the deadline has passed");
  }
  const round = poll.status === "round1" ? 1 : 2;
  const votes = await roundVotes(poll.id, round);
  if (votes.length === 0) throw new PollError(409, "There are no votes to close yet");
  if (round === 1) await closeRound1(poll.id);
  else await closeRound2(poll.id);
  return getPollState(slug, userId);
}

// ---------------------------------------------------------------------------
// View state (blind-safe)
// ---------------------------------------------------------------------------

export interface PollOption {
  titleId: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  genres: string[];
  votes: number | null; // null while the round is still blind
  survived?: boolean;
}

export interface PollViewState {
  slug: string;
  title: string;
  status: "round1" | "round2" | "done";
  expectedVoters: number;
  deadline: string | null;
  deadlinePassed: boolean;
  isCreator: boolean;
  signedIn: boolean;
  canVote: boolean;
  canClose: boolean;
  // Live progress for the active round (counts only — picks stay hidden).
  votesIn: number;
  votesNeeded: number;
  myPick: { titleId: string; title: string; posterUrl: string | null } | null;
  // Round-1 reveal (present once round 1 has closed).
  reveal: { topGenres: string[]; picks: PollOption[] } | null;
  // Round-2 ballot (survivors). Per-option votes only appear once done.
  round2: PollOption[] | null;
  winner: { title: string; year: number | null; posterUrl: string | null; href: string } | null;
}

export async function getPollState(slug: string, userId: string | null): Promise<PollViewState | null> {
  const [poll] = await db.select().from(polls).where(eq(polls.slug, slug));
  if (!poll) return null;

  const r1 = await roundVotes(poll.id, 1);
  const r2 = await roundVotes(poll.id, 2);
  const r1Voters = distinctVoters(r1);
  const r2Voters = distinctVoters(r2);

  const referenced = new Set<string>([
    ...r1.map((v) => v.titleId),
    ...r2.map((v) => v.titleId),
    ...(poll.round2TitleIds ?? []),
    ...(poll.winnerTitleId ? [poll.winnerTitleId] : []),
  ]);
  const titleMap = await loadTitles([...referenced]);

  const isCreator = Boolean(userId && poll.creatorId === userId);
  const deadlinePassed = Boolean(poll.deadline && Date.now() > poll.deadline.getTime());
  const myRound = poll.status === "round1" ? 1 : 2;
  const myVote = userId
    ? (poll.status === "round1" ? r1 : r2).find((v) => v.userId === userId) ?? null
    : null;
  const myPickTitle = myVote ? titleMap.get(myVote.titleId) : null;

  // Can this user still cast/change a vote in the active round?
  let canVote = false;
  if (userId && poll.status === "round1") {
    const voters = new Set(r1.map((v) => v.userId));
    canVote = voters.has(userId) || voters.size < poll.expectedVoters;
  } else if (userId && poll.status === "round2") {
    canVote = r1.some((v) => v.userId === userId);
  }

  const canClose =
    isCreator &&
    poll.status !== "done" &&
    (!poll.deadline || deadlinePassed) &&
    (poll.status === "round1" ? r1.length : r2.length) > 0;

  // Round-1 reveal (round 1 is over → picks are public).
  let reveal: PollViewState["reveal"] = null;
  if (poll.status !== "round1") {
    const tally = new Map<string, number>();
    for (const v of r1) tally.set(v.titleId, (tally.get(v.titleId) ?? 0) + 1);
    const survivors = new Set(poll.round2TitleIds ?? []);
    const top = topTierGenres(r1, titleMap);
    const genreNames = new Map<number, string>();
    for (const t of titleMap.values()) for (const g of t.genres) genreNames.set(g.id, g.name);
    const picks: PollOption[] = [...tally.keys()]
      .map((id) => {
        const t = titleMap.get(id);
        return {
          titleId: id,
          title: t?.title ?? "Unknown",
          year: t?.year ?? null,
          posterUrl: t?.posterUrl ?? null,
          href: t?.href ?? "#",
          genres: (t?.genres ?? []).map((g) => g.name).slice(0, 3),
          votes: tally.get(id) ?? 0,
          survived: survivors.has(id),
        };
      })
      .sort((a, b) => Number(b.survived) - Number(a.survived) || (b.votes ?? 0) - (a.votes ?? 0));
    reveal = {
      topGenres: [...top].map((g) => genreNames.get(g)).filter((n): n is string => Boolean(n)),
      picks,
    };
  }

  // Round-2 ballot.
  let round2: PollOption[] | null = null;
  if (poll.status === "round2" || (poll.status === "done" && (poll.round2TitleIds ?? []).length > 1)) {
    const done = poll.status === "done";
    const tally = new Map<string, number>();
    if (done) for (const v of r2) tally.set(v.titleId, (tally.get(v.titleId) ?? 0) + 1);
    round2 = (poll.round2TitleIds ?? []).map((id) => {
      const t = titleMap.get(id);
      return {
        titleId: id,
        title: t?.title ?? "Unknown",
        year: t?.year ?? null,
        posterUrl: t?.posterUrl ?? null,
        href: t?.href ?? "#",
        genres: (t?.genres ?? []).map((g) => g.name).slice(0, 3),
        votes: done ? tally.get(id) ?? 0 : null,
      };
    });
  }

  const winnerT = poll.winnerTitleId ? titleMap.get(poll.winnerTitleId) : null;

  return {
    slug: poll.slug,
    title: poll.title,
    status: poll.status,
    expectedVoters: poll.expectedVoters,
    deadline: poll.deadline ? poll.deadline.toISOString() : null,
    deadlinePassed,
    isCreator,
    signedIn: Boolean(userId),
    canVote,
    canClose,
    votesIn: poll.status === "round1" ? r1Voters : r2Voters,
    votesNeeded: poll.status === "round1" ? poll.expectedVoters : r1Voters,
    myPick: myPickTitle
      ? { titleId: myPickTitle.id, title: myPickTitle.title, posterUrl: myPickTitle.posterUrl }
      : null,
    reveal,
    round2,
    winner: winnerT
      ? { title: winnerT.title, year: winnerT.year, posterUrl: winnerT.posterUrl, href: winnerT.href }
      : null,
  };
}
