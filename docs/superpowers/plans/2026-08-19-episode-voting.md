# Episode Voting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a "Vote to Watch" poll ballot a specific TV episode, mixed freely with whole titles from other shows.

**Architecture:** Every poll identifier becomes an option key, `"{titleId}:{season}:{episode}"`, where `0:0` means the whole title, following the convention `list_items` already uses. `poll_votes` gains season and episode columns, and `round2_title_ids` becomes a text array of keys. The genre cull is untouched: an episode inherits its show's genres. The picker reuses the existing `ListEpisodePicker` rather than growing a parallel one.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle with CockroachDB, Zod contracts, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-episode-voting-design.md`

---

## Order matters here

`src/services/polls.ts` has no tests, and this plan renames the identifier threaded through
every function in it, in code that decides who won a vote. Task 1 pins the current
behaviour before anything changes. Those tests must still pass after Task 4, apart from the
rename. Do not reorder.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/services/polls.test.ts` (create) | Characterisation tests, written before any change |
| `src/lib/poll-option.ts` (create) | Pure option key encode, parse, classify |
| `src/lib/poll-option.test.ts` (create) | Tests for the above |
| `src/db/schema.ts` (modify) | Episode columns on `poll_votes`, keys and winner episode on `polls` |
| `src/services/polls.ts` (modify) | Threads keys instead of title uuids |
| `src/lib/poll-cull.ts` (modify) | Field rename only, logic unchanged |
| `src/lib/poll-cull.test.ts` (modify) | Rename plus a same-show survival case |
| `src/lib/contracts/polls.ts` (modify) | Optional season and episode on the vote input |
| `src/app/api/v1/polls/[slug]/vote/route.ts` (modify) | Passes them through |
| `src/components/poll/MoviePicker.tsx` (modify) | Episodes button opening the existing picker |
| `src/components/poll/PollRoom.tsx` (modify) | Renders an episode option |

---

### Task 1: Pin the current behaviour

No production code changes. If any test here fails, stop and report: it means the service
does not do what this plan assumes, and the rest of the plan needs revisiting.

**Files:**
- Create: `src/services/polls.test.ts`

- [ ] **Step 1: Write the characterisation tests**

Follow the DB-backed house style from `src/services/user-catalog.test.ts`: seed with a
`__vitest__` sentinel, clean up in `beforeAll` and `afterAll`.

Create `src/services/polls.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { profiles, titles, polls } from "@/db/schema";
import { createPoll, castVote, getPollState, PollError } from "./polls";

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
```

- [ ] **Step 2: Run them against the unchanged service**

Run: `npx vitest run src/services/polls.test.ts`
Expected: all 7 PASS. They describe what the code already does.

If any fail, STOP and report which. Do not "fix" the service to match the test: the test is
the thing that is wrong, or the plan's understanding is. Either way it needs a human.

- [ ] **Step 3: Commit**

```bash
git add src/services/polls.test.ts
git commit -m "Pin current Vote to Watch behaviour before the episode refactor"
```

---

### Task 2: Option keys

**Files:**
- Create: `src/lib/poll-option.ts`
- Create: `src/lib/poll-option.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/poll-option.test.ts`:

```ts
import { test, expect } from "vitest";
import { optionKey, parseOptionKey, isEpisode } from "./poll-option";

const UUID = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";

test("a whole title round trips through 0:0", () => {
  const key = optionKey(UUID);
  expect(key).toBe(`${UUID}:0:0`);
  expect(parseOptionKey(key)).toEqual({ titleId: UUID, season: 0, episode: 0 });
  expect(isEpisode(key)).toBe(false);
});

test("an episode round trips", () => {
  const key = optionKey(UUID, 2, 5);
  expect(key).toBe(`${UUID}:2:5`);
  expect(parseOptionKey(key)).toEqual({ titleId: UUID, season: 2, episode: 5 });
  expect(isEpisode(key)).toBe(true);
});

test("parseOptionKey rejects malformed keys", () => {
  expect(parseOptionKey("")).toBeNull();
  expect(parseOptionKey(UUID)).toBeNull();
  expect(parseOptionKey(`${UUID}:1`)).toBeNull();
  expect(parseOptionKey(`${UUID}:a:1`)).toBeNull();
  expect(parseOptionKey(`${UUID}:1:2:3`)).toBeNull();
  expect(parseOptionKey(`${UUID}:-1:2`)).toBeNull();
});

test("isEpisode is false for anything unparseable", () => {
  expect(isEpisode("rubbish")).toBe(false);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/poll-option.test.ts`
Expected: FAIL, cannot resolve `./poll-option`.

- [ ] **Step 3: Implement it**

Create `src/lib/poll-option.ts`:

```ts
/**
 * A poll option is either a whole title or one episode of it. Both are addressed
 * as "{titleId}:{season}:{episode}", where 0:0 means the whole title. That is the
 * same convention list_items and episode_watches already use, and it exists
 * because a uuid alone cannot say "season 1, episode 6".
 *
 * Keys are internal. They are built from database ids, never from user input, so
 * parseOptionKey guards against corrupt data rather than against an attacker.
 */
export interface OptionRef {
  titleId: string;
  season: number;
  episode: number;
}

export function optionKey(titleId: string, season = 0, episode = 0): string {
  return `${titleId}:${season}:${episode}`;
}

export function parseOptionKey(key: string): OptionRef | null {
  const parts = key.split(":");
  if (parts.length !== 3) return null;
  const [titleId, s, e] = parts;
  if (!titleId) return null;
  if (!/^\d+$/.test(s) || !/^\d+$/.test(e)) return null;
  return { titleId, season: Number(s), episode: Number(e) };
}

export function isEpisode(key: string): boolean {
  const ref = parseOptionKey(key);
  return ref !== null && ref.episode > 0;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/lib/poll-option.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/poll-option.ts src/lib/poll-option.test.ts
git commit -m "Add poll option keys for titles and episodes"
```

---

### Task 3: Schema

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add the episode columns to poll_votes**

In `src/db/schema.ts`, inside `pollVotes`, directly after the `titleId` column:

```ts
    // A specific TV episode of the title, or 0/0 for the whole movie/show, the
    // same convention list_items uses. 0 rather than NULL so comparisons stay
    // simple: NULLs compare distinct.
    seasonNumber: integer("season_number").notNull().default(0),
    episodeNumber: integer("episode_number").notNull().default(0),
    // Captured at vote time so rendering a ballot needs no TMDB call per option.
    episodeName: text("episode_name"),
```

- [ ] **Step 2: Swap the round-2 column and add the winner episode**

In the `polls` table, replace:

```ts
  round2TitleIds: uuid("round2_title_ids").array(),
```

with:

```ts
  // Surviving option keys after the round-1 genre cull (the round-2 ballot).
  // Text rather than uuid because an option can be one episode of a title.
  round2OptionKeys: text("round2_option_keys").array(),
```

and directly after `winnerTitleId`, add:

```ts
  winnerSeasonNumber: integer("winner_season_number").notNull().default(0),
  winnerEpisodeNumber: integer("winner_episode_number").notNull().default(0),
```

- [ ] **Step 3: Generate the migration**

Run: `npm run db:generate`
Expected: a new file under the drizzle migrations folder containing the added columns and
the dropped/added round-2 column.

- [ ] **Step 4: Add the backfill to the generated migration**

Open the generated SQL file and append, so in-flight polls keep their ballot:

```sql
--> statement-breakpoint
UPDATE "polls"
SET "round2_option_keys" = (
  SELECT array_agg(id::text || ':0:0') FROM unnest("round2_title_ids") AS id
)
WHERE "round2_title_ids" IS NOT NULL;
```

Place it BEFORE any statement that drops `round2_title_ids`. If the generated file drops
the old column first, move the drop below this statement.

- [ ] **Step 5: Apply and verify**

Run: `npm run db:push`
Expected: applies cleanly.

Run: `npx tsc --noEmit`
Expected: errors ONLY in `src/services/polls.ts`, pointing at `round2TitleIds`. That is
Task 4's work list. Do not fix them here.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle
git commit -m "Add episode columns and option keys to the poll schema"
```

---

### Task 4: Thread option keys through the service

The riskiest task. Task 1's tests must still pass at the end, unchanged.

**Files:**
- Modify: `src/lib/poll-cull.ts`
- Modify: `src/lib/poll-cull.test.ts`
- Modify: `src/services/polls.ts`

- [ ] **Step 1: Rename the cull field**

In `src/lib/poll-cull.ts`, change both function signatures so votes carry a key:

```ts
export function topTierGenres(
  votes: { optionKey: string }[],
  titleMap: Map<string, CullTitle>,
): Set<number>
```

```ts
export function computeSurvivors(
  votes: { optionKey: string }[],
  titleMap: Map<string, CullTitle>,
): string[]
```

Inside both, replace every `v.titleId` with `v.optionKey`. The logic is otherwise
untouched: it was always generic over string ids.

Update the doc comment on `computeSurvivors` to say "option" rather than "title".

- [ ] **Step 2: Update the cull tests and add a same-show case**

In `src/lib/poll-cull.test.ts`, rename the `titleId` field to `optionKey` in every vote
fixture, then append:

```ts
test("two episodes of one show both survive, since they share its genres", () => {
  const map = new Map([
    ["t1:1:1", { genreIds: [35], title: "Bottom: S1E1" }],
    ["t1:1:2", { genreIds: [35], title: "Bottom: S1E2" }],
  ]);
  const votes = [{ optionKey: "t1:1:1" }, { optionKey: "t1:1:2" }];
  // No genre separation, so nothing is culled and round 2 is a straight runoff.
  expect(computeSurvivors(votes, map).sort()).toEqual(["t1:1:1", "t1:1:2"]);
});
```

- [ ] **Step 3: Run the cull tests**

Run: `npx vitest run src/lib/poll-cull.test.ts`
Expected: PASS.

- [ ] **Step 4: Thread keys through the service**

In `src/services/polls.ts`:

- `roundVotes` selects the episode columns too and returns
  `{ voterKey, titleId, seasonNumber, episodeNumber, episodeName }`, mapped to an
  `optionKey` via `optionKey(v.titleId, v.seasonNumber, v.episodeNumber)`.
- Rename `loadTitles` to `loadOptions`. It takes option keys, parses them with
  `parseOptionKey`, skips any that fail, selects the distinct title rows once with the
  existing query, then returns a `Map<string, TitleLite>` keyed by option key. For an
  episode, override `title` with `` `${row.title}: S${season}E${episode}` `` plus the
  episode name when one is stored, and `href` with
  `` `/title/tv/${tmdbId}-${slug}/s${season}e${episode}` ``. `genreIds`, `rating` and
  `posterUrl` still come from the show, which is what keeps the cull working.
- `closeRound1` and `closeRound2` tally by option key. Write survivors to
  `round2OptionKeys`. On close, write the winner's key back as `winnerTitleId` plus
  `winnerSeasonNumber` and `winnerEpisodeNumber` via `parseOptionKey`.
- `castVote` builds its key with `optionKey(title.id, season, episode)` and checks
  round-2 membership against `poll.round2OptionKeys`.
- `getPollState` builds its `referenced` set from option keys, including the winner's,
  which it reconstructs with `optionKey(poll.winnerTitleId, poll.winnerSeasonNumber,
  poll.winnerEpisodeNumber)`.
- `PollOption.titleId` becomes `key`, and the interface gains
  `seasonNumber: number`, `episodeNumber: number`, `episodeName: string | null`.
  `PollViewState.myPick` gains the same three fields and its `titleId` becomes `key`.

Do not change `castVote`'s signature yet. Episodes arrive in Task 5. Every call in this
task passes 0 and 0, so behaviour is identical.

- [ ] **Step 5: Verify nothing moved**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx vitest run src/services/polls.test.ts src/lib/poll-cull.test.ts`
Expected: PASS, with Task 1's tests unchanged apart from `myPick.titleId` becoming
`myPick.key` if you asserted on it (the fixtures above assert on `title`, so they should
need no edit at all).

If a Task 1 test fails, the refactor changed behaviour. Fix the refactor, not the test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/poll-cull.ts src/lib/poll-cull.test.ts src/services/polls.ts
git commit -m "Thread option keys through the poll service"
```

---

### Task 5: Accept an episode vote

**Files:**
- Modify: `src/lib/contracts/polls.ts`
- Modify: `src/services/polls.ts`
- Modify: `src/app/api/v1/polls/[slug]/vote/route.ts`
- Modify: `src/services/polls.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/services/polls.test.ts`. Add `vi` to the vitest import, and add this mock
at the TOP of the file, above the other imports, so the episode lookup does not call TMDB:

```ts
vi.mock("@/services/tv-season", () => ({
  oneEpisode: vi.fn(async (_tv: number, s: number, e: number) =>
    s === 1 && e === 1 ? { episodeNumber: 1, name: "Pilot", overview: "", runtime: 30, airDate: "2008-01-20", stillUrl: null, voteAverage: null, voteCount: null, cast: [] } : null,
  ),
  seasonEpisodes: vi.fn(),
}));
```

Then append:

```ts
test("an episode vote stores the season, episode and captured name", async () => {
  const { slug } = await createPoll(creatorId, { title: "__vitest__ ep", expectedVoters: 3 });
  const state = await castVote(slug, voter("g1"), "tv", 99912004, 1, 1);
  expect(state?.myPick?.seasonNumber).toBe(1);
  expect(state?.myPick?.episodeNumber).toBe(1);
  expect(state?.myPick?.title).toContain("S1E1");
  expect(state?.myPick?.title).toContain("Pilot");
});

test("a vote for an episode that does not exist is rejected", async () => {
  const { slug } = await createPoll(creatorId, { title: "__vitest__ badep", expectedVoters: 3 });
  await expect(castVote(slug, voter("g2"), "tv", 99912004, 9, 9)).rejects.toBeInstanceOf(PollError);
});

test("two episodes of one show are two options, not one", async () => {
  const { slug } = await createPoll(creatorId, { title: "__vitest__ two", expectedVoters: 2 });
  await castVote(slug, voter("h1"), "tv", 99912004, 1, 1);
  const state = await castVote(slug, voter("h2"), "tv", 99912004, 0, 0);
  expect(state?.reveal?.picks.length).toBe(2);
});
```

These need a TV row to vote on, so replace the `SEEDS` constant and the insert loop in
`beforeAll` with these exact versions:

```ts
const SEEDS = [
  { tmdbId: 99912001, title: "Poll Comedy A", mediaType: "movie" as const, genres: [{ id: 35, name: "Comedy" }] },
  { tmdbId: 99912002, title: "Poll Comedy B", mediaType: "movie" as const, genres: [{ id: 35, name: "Comedy" }] },
  { tmdbId: 99912003, title: "Poll Horror C", mediaType: "movie" as const, genres: [{ id: 27, name: "Horror" }] },
  { tmdbId: 99912004, title: "Poll Show D", mediaType: "tv" as const, genres: [{ id: 35, name: "Comedy" }] },
];
```

```ts
  for (const s of SEEDS) {
    await db.insert(titles).values({
      tmdbId: s.tmdbId,
      mediaType: s.mediaType,
      slug: `poll-test-${s.tmdbId}`,
      title: s.title,
      releaseYear: 2020,
      posterPath: "/p.jpg",
      refreshedAt: new Date(),
      metadata: { id: s.tmdbId, title: s.title, genres: s.genres, vote_average: 7 },
    });
  }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run src/services/polls.test.ts`
Expected: the three new tests FAIL, because `castVote` takes only four arguments.

- [ ] **Step 3: Extend the contract**

In `src/lib/contracts/polls.ts`, replace `export const castVoteInput = titleRef;` with:

```ts
// Bounds match parseEpisodeSlug in src/lib/tmdb/detail.ts, so the URL parser and
// the vote endpoint agree on what counts as a plausible episode.
export const castVoteInput = titleRef
  .extend({
    seasonNumber: z.number().int().min(1).max(999).optional(),
    episodeNumber: z.number().int().min(1).max(9999).optional(),
  })
  .refine((v) => (v.seasonNumber == null) === (v.episodeNumber == null), {
    message: "season and episode must be given together",
  })
  .refine((v) => v.mediaType === "tv" || v.seasonNumber == null, {
    message: "only a TV show has episodes",
  });
```

- [ ] **Step 4: Accept them in the service**

In `src/services/polls.ts`, change the signature to:

```ts
export async function castVote(
  slug: string,
  voter: VoterIdentity,
  mediaType: "movie" | "tv",
  tmdbId: number,
  seasonNumber = 0,
  episodeNumber = 0,
): Promise<PollViewState | null> {
```

After resolving `title` with `getOrCreateTitle`, add:

```ts
  // Confirm the episode is real before it can reach a ballot, and capture its
  // name so rendering the ballot later needs no TMDB call per option.
  let episodeName: string | null = null;
  if (episodeNumber > 0) {
    const episode = await oneEpisode(tmdbId, seasonNumber, episodeNumber);
    if (!episode) throw new PollError(404, "That episode does not exist");
    episodeName = episode.name;
  }
```

Import `oneEpisode` from `@/services/tv-season`. Include `seasonNumber`, `episodeNumber`
and `episodeName` in both the insert values and the `onConflictDoUpdate` set.

- [ ] **Step 5: Pass them through the route**

In `src/app/api/v1/polls/[slug]/vote/route.ts`:

```ts
    const { mediaType, tmdbId, seasonNumber, episodeNumber } = castVoteInput.parse(await req.json());
    const { identity, issueToken } = await resolveOrIssueVoter();
    const state = await castVote(slug, identity, mediaType, tmdbId, seasonNumber ?? 0, episodeNumber ?? 0);
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` (expect no output)
Run: `npx vitest run src/services/polls.test.ts` (expect all PASS, old and new)
Run: `npx next build` (expect "Compiled successfully")

- [ ] **Step 7: Commit**

```bash
git add src/lib/contracts/polls.ts src/services/polls.ts "src/app/api/v1/polls/[slug]/vote/route.ts" src/services/polls.test.ts
git commit -m "Accept a vote for a specific episode"
```

---

### Task 6: Pick an episode in the poll UI

**Files:**
- Modify: `src/components/poll/MoviePicker.tsx`
- Modify: `src/components/poll/PollRoom.tsx`

- [ ] **Step 1: Add the Episodes affordance**

`ListEditor` already does exactly this. Read `src/components/account/ListEditor.tsx` around
the results list first, then mirror it in `MoviePicker`.

Widen the `onPick` callback:

```tsx
  onPick: (r: {
    mediaType: "movie" | "tv";
    tmdbId: number;
    title: string;
    seasonNumber?: number;
    episodeNumber?: number;
  }) => void;
```

Add state for the open show, `const [episodeShow, setEpisodeShow] = useState<TitleResult | null>(null)`,
render an "Episodes" button on TV results that toggles it, and below that result render:

```tsx
{episodeShow?.tmdbId === r.tmdbId && (
  <div className="px-3 pb-3">
    <ListEpisodePicker
      tvId={r.tmdbId}
      showTitle={r.title}
      have={new Set()}
      onAdd={(ep) => {
        onPick({
          mediaType: "tv",
          tmdbId: r.tmdbId,
          title: `${r.title}: S${ep.seasonNumber}E${ep.episodeNumber} ${ep.name}`,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
        });
        setEpisodeShow(null);
      }}
      onClose={() => setEpisodeShow(null)}
    />
  </div>
)}
```

Import it: `import { ListEpisodePicker } from "@/components/account/ListEpisodePicker";`

`have` is an empty set here: a poll has no "already added" concept, each voter holds one
pick at a time.

- [ ] **Step 2: Send the episode when voting**

In `src/components/poll/PollRoom.tsx`, find where `onPick` posts to
`/api/v1/polls/{slug}/vote` and include the two new fields in the JSON body when present.
Options rendered from `PollOption` should use `o.key` where they previously used
`o.titleId`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (expect no output)
Run: `npx eslint src/components/poll/MoviePicker.tsx src/components/poll/PollRoom.tsx` (expect no output)
Run: `npx next build` (expect "Compiled successfully")

- [ ] **Step 4: Commit**

```bash
git add src/components/poll/MoviePicker.tsx src/components/poll/PollRoom.tsx
git commit -m "Pick an episode when voting"
```

---

### Task 7: Verify the whole feature

**Files:** none changed.

- [ ] **Step 1: Full check**

Run: `npx tsc --noEmit` (expect no output)
Run: `npx vitest run src/services/polls.test.ts src/lib/poll-option.test.ts src/lib/poll-cull.test.ts` (expect PASS)
Run: `npx next build` (expect "Compiled successfully")

- [ ] **Step 2: Exercise it after deploy**

Create a vote from `/account`, share the link, and from two browsers: pick a whole film in
one and an episode in the other, using the Episodes button. Confirm the ballot shows
`Show: S1E1 Name` with the show poster, that the winner links to the episode page shipped
on 2026-08-18, and that a poll mixing an episode and a film still culls sensibly.

- [ ] **Step 3: Known unrelated failures**

`src/services/site-config.test.ts` is fixed, but `PageShell.stories.tsx` can fail under
parallel load with a Clerk provider error, and the full suite is flaky on a loaded machine.
Neither is related to this work.

---

## Notes for the implementer

- **Never commit `producthunt-launch-copy.md`.** Targeted `git add` with explicit paths only.
- **No em dashes** in any user-facing string or comment.
- **No `Co-Authored-By`** trailer on commits.
- Task 1's tests are the safety net for Task 4. If they fail after the refactor, the
  refactor is wrong, not the tests.
- The DB-backed tests need `DATABASE_URL`, which is already in `.env` and `.env.local`.
