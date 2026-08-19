import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { polls, pollVotes, titles } from "@/db/schema";
import { getOrCreateTitle } from "./catalog";
import { posterUrl } from "@/lib/tmdb/images";
import { computeSurvivors, topTierGenres, OTHER_GENRE } from "@/lib/poll-cull";
import { optionKey, parseOptionKey } from "@/lib/poll-option";
import type { VoterIdentity } from "./voter";
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
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string | null;
}

/**
 * Loads the titles behind a set of option keys. An option key that fails to
 * parse (corrupt data, not attacker input — see poll-option.ts) is skipped
 * rather than thrown on, so one bad key doesn't take down the whole poll.
 */
async function loadOptions(keys: string[]): Promise<Map<string, TitleLite>> {
  const map = new Map<string, TitleLite>();
  if (keys.length === 0) return map;

  const refs = new Map<string, { titleId: string; season: number; episode: number }>();
  for (const key of keys) {
    const ref = parseOptionKey(key);
    if (ref) refs.set(key, ref);
  }
  if (refs.size === 0) return map;

  const titleIds = [...new Set([...refs.values()].map((r) => r.titleId))];
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
    .where(inArray(titles.id, titleIds));
  const rowsById = new Map(rows.map((r) => [r.id, r]));

  // Episode names are captured at vote time (poll_votes.episode_name), since a
  // key alone ("titleId:season:episode") can't carry the name itself.
  const episodeNames = new Map<string, string>();
  const episodeTitleIds = [...new Set([...refs.values()].filter((r) => r.episode > 0).map((r) => r.titleId))];
  if (episodeTitleIds.length > 0) {
    const epRows = await db
      .select({
        titleId: pollVotes.titleId,
        seasonNumber: pollVotes.seasonNumber,
        episodeNumber: pollVotes.episodeNumber,
        episodeName: pollVotes.episodeName,
      })
      .from(pollVotes)
      .where(inArray(pollVotes.titleId, episodeTitleIds));
    for (const er of epRows) {
      if (!er.episodeName) continue;
      episodeNames.set(optionKey(er.titleId, er.seasonNumber, er.episodeNumber), er.episodeName);
    }
  }

  for (const [key, ref] of refs) {
    const r = rowsById.get(ref.titleId);
    if (!r) continue;
    const meta = (r.metadata ?? {}) as TmdbTitleDetail;
    const genres = (meta.genres ?? []).map((g) => ({ id: g.id, name: g.name }));
    const isEp = ref.episode > 0;
    const episodeName = isEp ? episodeNames.get(key) ?? null : null;
    map.set(key, {
      id: r.id,
      tmdbId: r.tmdbId,
      mediaType: r.mediaType,
      title: isEp ? `${r.title}: S${ref.season}E${ref.episode}${episodeName ? ` - ${episodeName}` : ""}` : r.title,
      year: r.year,
      posterUrl: posterUrl(r.posterPath),
      href: isEp
        ? `/title/tv/${r.tmdbId}-${r.slug}/s${ref.season}e${ref.episode}`
        : `/title/${r.mediaType}/${r.tmdbId}-${r.slug}`,
      genreIds: genres.length ? genres.map((g) => g.id) : [OTHER_GENRE],
      genres,
      rating: typeof meta.vote_average === "number" ? meta.vote_average : 0,
      seasonNumber: ref.season,
      episodeNumber: ref.episode,
      episodeName,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Round logic
// ---------------------------------------------------------------------------

interface VoteLite {
  voterKey: string;
  titleId: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string | null;
  optionKey: string;
}

async function roundVotes(pollId: string, round: number): Promise<VoteLite[]> {
  const rows = await db
    .select({
      voterKey: pollVotes.voterKey,
      titleId: pollVotes.titleId,
      seasonNumber: pollVotes.seasonNumber,
      episodeNumber: pollVotes.episodeNumber,
      episodeName: pollVotes.episodeName,
    })
    .from(pollVotes)
    .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.round, round)));
  return rows.map((r) => ({ ...r, optionKey: optionKey(r.titleId, r.seasonNumber, r.episodeNumber) }));
}

function distinctVoters(votes: VoteLite[]): number {
  return new Set(votes.map((v) => v.voterKey)).size;
}

/** Close round 1: cull by genre, then either crown a sole survivor or open round 2. */
async function closeRound1(pollId: string): Promise<void> {
  const votes = await roundVotes(pollId, 1);
  const titleMap = await loadOptions(votes.map((v) => v.optionKey));
  const survivors = computeSurvivors(votes, titleMap);
  if (survivors.length <= 1) {
    const winnerRef = survivors[0] ? parseOptionKey(survivors[0]) : null;
    await db
      .update(polls)
      .set({
        status: "done",
        round2OptionKeys: survivors,
        winnerTitleId: winnerRef?.titleId ?? null,
        winnerSeasonNumber: winnerRef?.season ?? 0,
        winnerEpisodeNumber: winnerRef?.episode ?? 0,
      })
      .where(eq(polls.id, pollId));
  } else {
    await db.update(polls).set({ status: "round2", round2OptionKeys: survivors }).where(eq(polls.id, pollId));
  }
}

/** Close round 2: most-voted survivor wins (tie → higher TMDB rating, then title). */
async function closeRound2(pollId: string): Promise<void> {
  const votes = await roundVotes(pollId, 2);
  const titleMap = await loadOptions(votes.map((v) => v.optionKey));
  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.optionKey, (tally.get(v.optionKey) ?? 0) + 1);
  let winner: string | null = null;
  let best = { votes: -1, rating: -1, title: "" };
  for (const [key, n] of tally) {
    const t = titleMap.get(key);
    const cand = { votes: n, rating: t?.rating ?? 0, title: t?.title ?? "" };
    if (
      cand.votes > best.votes ||
      (cand.votes === best.votes && cand.rating > best.rating) ||
      (cand.votes === best.votes && cand.rating === best.rating && cand.title.localeCompare(best.title) < 0)
    ) {
      best = cand;
      winner = key;
    }
  }
  const winnerRef = winner ? parseOptionKey(winner) : null;
  await db
    .update(polls)
    .set({
      status: "done",
      winnerTitleId: winnerRef?.titleId ?? null,
      winnerSeasonNumber: winnerRef?.season ?? 0,
      winnerEpisodeNumber: winnerRef?.episode ?? 0,
    })
    .where(eq(polls.id, pollId));
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
  const winnerKeys = rows
    .filter((r): r is typeof r & { winnerTitleId: string } => Boolean(r.winnerTitleId))
    .map((r) => optionKey(r.winnerTitleId, r.winnerSeasonNumber, r.winnerEpisodeNumber));
  const titleMap = await loadOptions(winnerKeys);
  const summaries: PollSummary[] = [];
  for (const r of rows) {
    const votes = await roundVotes(r.id, 1);
    const winnerKey = r.winnerTitleId ? optionKey(r.winnerTitleId, r.winnerSeasonNumber, r.winnerEpisodeNumber) : null;
    summaries.push({
      id: r.id,
      slug: r.slug,
      title: r.title,
      status: r.status,
      expectedVoters: r.expectedVoters,
      deadline: r.deadline ? r.deadline.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      round1Votes: distinctVoters(votes),
      winnerTitle: winnerKey ? titleMap.get(winnerKey)?.title ?? null : null,
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
  voter: VoterIdentity,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<PollViewState | null> {
  const [poll] = await db.select().from(polls).where(eq(polls.slug, slug));
  if (!poll) return null;
  if (poll.status === "done") throw new PollError(409, "Voting has ended");

  const round = poll.status === "round1" ? 1 : 2;
  const title = await getOrCreateTitle(mediaType, tmdbId);
  // Episodes arrive in a later task; every option cast here is the whole title.
  const key = optionKey(title.id, 0, 0);

  if (round === 1) {
    const votes = await roundVotes(poll.id, 1);
    const voters = new Set(votes.map((v) => v.voterKey));
    if (!voters.has(voter.voterKey) && voters.size >= poll.expectedVoters) {
      throw new PollError(409, "This vote is already full");
    }
  } else {
    const [mine] = await db
      .select({ id: pollVotes.id })
      .from(pollVotes)
      .where(and(eq(pollVotes.pollId, poll.id), eq(pollVotes.voterKey, voter.voterKey), eq(pollVotes.round, 1)));
    if (!mine) throw new PollError(403, "Only round-1 voters can vote in round 2");
    if (!(poll.round2OptionKeys ?? []).includes(key)) {
      throw new PollError(409, "That option was eliminated in round 1");
    }
  }

  await db
    .insert(pollVotes)
    .values({ pollId: poll.id, userId: voter.userId, voterKey: voter.voterKey, round, titleId: title.id })
    .onConflictDoUpdate({
      target: [pollVotes.pollId, pollVotes.voterKey, pollVotes.round],
      set: { titleId: title.id, userId: voter.userId, createdAt: new Date() },
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

  return getPollState(slug, voter);
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
  return getPollState(slug, { userId, voterKey: `u:${userId}` });
}

// ---------------------------------------------------------------------------
// View state (blind-safe)
// ---------------------------------------------------------------------------

export interface PollOption {
  key: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  genres: string[];
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string | null;
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
  myPick: {
    key: string;
    title: string;
    posterUrl: string | null;
    seasonNumber: number;
    episodeNumber: number;
    episodeName: string | null;
  } | null;
  // Round-1 reveal (present once round 1 has closed).
  reveal: { topGenres: string[]; picks: PollOption[] } | null;
  // Round-2 ballot (survivors). Per-option votes only appear once done.
  round2: PollOption[] | null;
  winner: { title: string; year: number | null; posterUrl: string | null; href: string } | null;
}

export async function getPollState(
  slug: string,
  voter: VoterIdentity | null,
): Promise<PollViewState | null> {
  const [poll] = await db.select().from(polls).where(eq(polls.slug, slug));
  if (!poll) return null;

  const r1 = await roundVotes(poll.id, 1);
  const r2 = await roundVotes(poll.id, 2);
  const r1Voters = distinctVoters(r1);
  const r2Voters = distinctVoters(r2);

  const winnerKey = poll.winnerTitleId
    ? optionKey(poll.winnerTitleId, poll.winnerSeasonNumber, poll.winnerEpisodeNumber)
    : null;

  const referenced = new Set<string>([
    ...r1.map((v) => v.optionKey),
    ...r2.map((v) => v.optionKey),
    ...(poll.round2OptionKeys ?? []),
    ...(winnerKey ? [winnerKey] : []),
  ]);
  const titleMap = await loadOptions([...referenced]);

  const voterKey = voter?.voterKey ?? null;
  const isCreator = Boolean(voter?.userId && poll.creatorId === voter.userId);
  const deadlinePassed = Boolean(poll.deadline && Date.now() > poll.deadline.getTime());
  const myVote = voterKey
    ? (poll.status === "round1" ? r1 : r2).find((v) => v.voterKey === voterKey) ?? null
    : null;
  const myPickTitle = myVote ? titleMap.get(myVote.optionKey) : null;

  // Can this voter still cast/change a vote in the active round? Guests count —
  // a null voterKey just means "no vote yet", so capacity is what gates round 1.
  let canVote = false;
  if (poll.status === "round1") {
    const voters = new Set(r1.map((v) => v.voterKey));
    canVote = (voterKey != null && voters.has(voterKey)) || voters.size < poll.expectedVoters;
  } else if (poll.status === "round2") {
    canVote = voterKey != null && r1.some((v) => v.voterKey === voterKey);
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
    for (const v of r1) tally.set(v.optionKey, (tally.get(v.optionKey) ?? 0) + 1);
    const survivors = new Set(poll.round2OptionKeys ?? []);
    const top = topTierGenres(r1, titleMap);
    const genreNames = new Map<number, string>();
    for (const t of titleMap.values()) for (const g of t.genres) genreNames.set(g.id, g.name);
    const picks: PollOption[] = [...tally.keys()]
      .map((key) => {
        const t = titleMap.get(key);
        return {
          key,
          title: t?.title ?? "Unknown",
          year: t?.year ?? null,
          posterUrl: t?.posterUrl ?? null,
          href: t?.href ?? "#",
          genres: (t?.genres ?? []).map((g) => g.name).slice(0, 3),
          seasonNumber: t?.seasonNumber ?? 0,
          episodeNumber: t?.episodeNumber ?? 0,
          episodeName: t?.episodeName ?? null,
          votes: tally.get(key) ?? 0,
          survived: survivors.has(key),
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
  if (poll.status === "round2" || (poll.status === "done" && (poll.round2OptionKeys ?? []).length > 1)) {
    const done = poll.status === "done";
    const tally = new Map<string, number>();
    if (done) for (const v of r2) tally.set(v.optionKey, (tally.get(v.optionKey) ?? 0) + 1);
    round2 = (poll.round2OptionKeys ?? []).map((key) => {
      const t = titleMap.get(key);
      return {
        key,
        title: t?.title ?? "Unknown",
        year: t?.year ?? null,
        posterUrl: t?.posterUrl ?? null,
        href: t?.href ?? "#",
        genres: (t?.genres ?? []).map((g) => g.name).slice(0, 3),
        seasonNumber: t?.seasonNumber ?? 0,
        episodeNumber: t?.episodeNumber ?? 0,
        episodeName: t?.episodeName ?? null,
        votes: done ? tally.get(key) ?? 0 : null,
      };
    });
  }

  const winnerT = winnerKey ? titleMap.get(winnerKey) : null;

  return {
    slug: poll.slug,
    title: poll.title,
    status: poll.status,
    expectedVoters: poll.expectedVoters,
    deadline: poll.deadline ? poll.deadline.toISOString() : null,
    deadlinePassed,
    isCreator,
    signedIn: Boolean(voter?.userId),
    canVote,
    canClose,
    votesIn: poll.status === "round1" ? r1Voters : r2Voters,
    votesNeeded: poll.status === "round1" ? poll.expectedVoters : r1Voters,
    myPick:
      myVote && myPickTitle
        ? {
            key: myVote.optionKey,
            title: myPickTitle.title,
            posterUrl: myPickTitle.posterUrl,
            seasonNumber: myPickTitle.seasonNumber,
            episodeNumber: myPickTitle.episodeNumber,
            episodeName: myPickTitle.episodeName,
          }
        : null,
    reveal,
    round2,
    winner: winnerT
      ? { title: winnerT.title, year: winnerT.year, posterUrl: winnerT.posterUrl, href: winnerT.href }
      : null,
  };
}
