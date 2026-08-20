# TV Liveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The TV detail page answers "is this show still alive?" (AiringBanner, for everyone) and "where am I in it?" (WatchProgress, signed-in), from data already cached or local.

**Architecture:** The daily-cached `tvAiring` call in `tv-status.ts` widens to return status plus next episode plus last air date in one shared cache entry. A pure `airingLabel` turns that into a display decision, a pure `nextUnwatched` computes progress from the watched set plus season episode counts already in title metadata, and two Suspense-streamed server components render them. The GB channel line reads one already-cached guide day.

**Tech Stack:** Next.js 16 App Router with `cacheComponents`, Drizzle/CockroachDB, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-tv-liveness-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/tv-status.ts` (modify) | Gains pure `airingLabel` beside `statusBadge` |
| `src/lib/tv-status.test.ts` (create) | Tests for both pure helpers |
| `src/services/tv-status.ts` (modify) | `tvAiringInfo` widened cached call; `tvStatus` reads it |
| `src/services/tv-status.test.ts` (create) | Mocked-client tests for the shared call and error shape |
| `src/lib/watch-progress.ts` (create) | Pure `nextUnwatched` |
| `src/lib/watch-progress.test.ts` (create) | Tests for it |
| `src/services/guide.ts` (modify) | Pure `findBroadcast` + thin `broadcastFor` wrapper |
| `src/services/guide.test.ts` (create) | Tests for `findBroadcast` |
| `src/components/catalog/AiringBanner.tsx` (create) | Status/next-episode banner |
| `src/components/catalog/WatchProgress.tsx` (create) | Progress summary |
| `src/app/title/[mediaType]/[idSlug]/page.tsx` (modify) | Wires both in |

## Notes for the implementer

- **Never commit `producthunt-launch-copy.md`.** Targeted `git add` with explicit paths only.
- **No em dashes** in any user-facing string or comment. No `Co-Authored-By` trailer.
- Vitest aliases `server-only` and `next/cache` to stubs, so cached service functions are directly unit-testable.
- Paths with brackets must be quoted in shell commands.
- `src/components/layout/PageShell.stories.tsx` fails in the full suite for a pre-existing Clerk reason. Ignore it; do not fix it.

---

### Task 1: The airing label decision

**Files:**
- Modify: `src/lib/tv-status.ts`
- Create: `src/lib/tv-status.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/tv-status.test.ts`:

```ts
import { test, expect } from "vitest";
import { statusBadge, airingLabel, type TvAiringInfo } from "./tv-status";

const NEXT = { seasonNumber: 3, episodeNumber: 5, name: "The Heist", airDate: "2026-08-22" };
const info = (over: Partial<TvAiringInfo>): TvAiringInfo => ({
  status: "Returning Series",
  nextEpisode: null,
  lastAirDate: "2024-05-01",
  ...over,
});

test("statusBadge is unchanged", () => {
  expect(statusBadge("Ended")).toEqual({ label: "Ended", tone: "neutral" });
  expect(statusBadge("Returning Series")).toBeNull();
});

test("a scheduled episode today, tomorrow, this week, and beyond", () => {
  const at = (airDate: string) => airingLabel(info({ nextEpisode: { ...NEXT, airDate } }), "2026-08-20");
  expect(at("2026-08-20")).toMatchObject({ kind: "next-episode", when: "Today" });
  expect(at("2026-08-21")).toMatchObject({ kind: "next-episode", when: "Tomorrow" });
  expect(at("2026-08-22")).toMatchObject({ kind: "next-episode", when: "Saturday" });
  expect(at("2026-08-26")).toMatchObject({ kind: "next-episode", when: "Wednesday" });
  expect(at("2026-08-27")).toMatchObject({ kind: "next-episode", when: "27 Aug" });
});

test("a past or malformed air date degrades to returning", () => {
  expect(airingLabel(info({ nextEpisode: { ...NEXT, airDate: "2026-08-19" } }), "2026-08-20")?.kind).toBe("returning");
  expect(airingLabel(info({ nextEpisode: { ...NEXT, airDate: "not-a-date" } }), "2026-08-20")?.kind).toBe("returning");
  expect(airingLabel(info({ nextEpisode: { ...NEXT, airDate: null } }), "2026-08-20")?.kind).toBe("returning");
});

test("returning with nothing scheduled", () => {
  expect(airingLabel(info({}), "2026-08-20")).toMatchObject({ kind: "returning", when: null });
});

test("ended and cancelled map to their kinds", () => {
  expect(airingLabel(info({ status: "Ended" }), "2026-08-20")?.kind).toBe("ended");
  expect(airingLabel(info({ status: "Canceled" }), "2026-08-20")?.kind).toBe("cancelled");
});

test("an unmapped status shows in-production only when nothing has aired", () => {
  expect(airingLabel(info({ status: "In Production", lastAirDate: null }), "2026-08-20")?.kind).toBe("in-production");
  expect(airingLabel(info({ status: "Pilot", lastAirDate: null }), "2026-08-20")?.kind).toBe("in-production");
  expect(airingLabel(info({ status: "In Production" }), "2026-08-20")).toBeNull();
  expect(airingLabel(info({ status: null }), "2026-08-20")).toBeNull();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/tv-status.test.ts`
Expected: FAIL, `airingLabel` and `TvAiringInfo` are not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/tv-status.ts`:

```ts
/** The widened shape of the daily-cached tvAiring call, defined here (client-safe
 *  and pure) so the label logic is testable without the service. */
export interface TvAiringInfo {
  status: string | null;
  nextEpisode: {
    seasonNumber: number;
    episodeNumber: number;
    name: string | null;
    airDate: string | null;
  } | null;
  lastAirDate: string | null;
}

export interface AiringLabel {
  kind: "next-episode" | "returning" | "ended" | "cancelled" | "in-production";
  /** "Today", "Tomorrow", a weekday inside 7 days, or "27 Aug". Only for next-episode. */
  when: string | null;
}

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse a strict YYYY-MM-DD as UTC midnight, null otherwise. Date.parse alone
 *  accepts too much ("not-a-date" pieces, bare years), so validate the shape. */
function ymdToUtc(ymd: string | null): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const t = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

/**
 * The banner's display decision, pure so every date boundary is unit-testable.
 * todayYmd is resolved at the request boundary by the caller, never from a clock
 * here: render purity, and the server and client must agree on what "today" is.
 */
export function airingLabel(info: TvAiringInfo, todayYmd: string): AiringLabel | null {
  const badge = statusBadge(info.status);
  if (badge) return { kind: badge.label === "Ended" ? "ended" : "cancelled", when: null };

  const s = info.status?.trim().toLowerCase() ?? null;
  const returning = s === "returning series";

  const today = ymdToUtc(todayYmd);
  const air = ymdToUtc(info.nextEpisode?.airDate ?? null);
  if (info.nextEpisode && today != null && air != null && air >= today) {
    const days = Math.round((air - today) / DAY_MS);
    const when =
      days === 0
        ? "Today"
        : days === 1
          ? "Tomorrow"
          : days < 7
            ? WEEKDAYS[new Date(air).getUTCDay()]
            : `${new Date(air).getUTCDate()} ${MONTHS[new Date(air).getUTCMonth()]}`;
    return { kind: "next-episode", when };
  }

  if (returning) return { kind: "returning", when: null };
  // Unmapped pre-release statuses ("In Production", "Pilot", "Planned"): only
  // worth a line when nothing has aired yet; on an airing show they are noise.
  if (s && info.lastAirDate == null) return { kind: "in-production", when: null };
  return null;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/lib/tv-status.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit` (expect no output)

```bash
git add src/lib/tv-status.ts src/lib/tv-status.test.ts
git commit -m "Decide the airing banner label from airing info"
```

---

### Task 2: Widen the cached airing call

**Files:**
- Modify: `src/services/tv-status.ts`
- Create: `src/services/tv-status.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/tv-status.test.ts`:

```ts
import { vi, test, expect, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/tmdb/client", () => ({
  tmdb: { tvAiring: vi.fn() },
}));

import { tmdb } from "@/lib/tmdb/client";
import { tvAiringInfo, tvStatusBadges } from "./tv-status";

beforeEach(() => vi.clearAllMocks());

test("returns status, next episode and last air date from one call", async () => {
  (tmdb.tvAiring as Mock).mockResolvedValue({
    status: "Returning Series",
    last_air_date: "2026-08-13",
    next_episode_to_air: { season_number: 3, episode_number: 5, name: "The Heist", air_date: "2026-08-22" },
  });
  expect(await tvAiringInfo(1396)).toEqual({
    status: "Returning Series",
    lastAirDate: "2026-08-13",
    nextEpisode: { seasonNumber: 3, episodeNumber: 5, name: "The Heist", airDate: "2026-08-22" },
  });
});

test("a show with nothing scheduled has a null nextEpisode", async () => {
  (tmdb.tvAiring as Mock).mockResolvedValue({ status: "Ended", last_air_date: "2013-09-29" });
  expect(await tvAiringInfo(1396)).toEqual({ status: "Ended", lastAirDate: "2013-09-29", nextEpisode: null });
});

test("an upstream failure returns the all-null shape rather than throwing", async () => {
  (tmdb.tvAiring as Mock).mockRejectedValue(new Error("TMDB 502"));
  expect(await tvAiringInfo(1396)).toEqual({ status: null, lastAirDate: null, nextEpisode: null });
});

test("the badge path reads the same widened call", async () => {
  (tmdb.tvAiring as Mock).mockResolvedValue({ status: "Ended" });
  const map = await tvStatusBadges([{ mediaType: "tv", tmdbId: 1396 }]);
  expect(map.get(1396)).toEqual({ label: "Ended", tone: "neutral" });
  expect((tmdb.tvAiring as Mock).mock.calls.length).toBe(1);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/services/tv-status.test.ts`
Expected: FAIL, `tvAiringInfo` is not exported.

- [ ] **Step 3: Implement**

In `src/services/tv-status.ts`, replace the `tvStatus` function with:

```ts
import { statusBadge, type StatusBadge, type TvAiringInfo } from "@/lib/tv-status";

const NULL_INFO: TvAiringInfo = { status: null, nextEpisode: null, lastAirDate: null };

/** Status, next scheduled episode and last air date for one show, from the one
 *  tvAiring call this service already made and cached daily. The banner and the
 *  card badge both read this entry, so widening it added no TMDB volume. Errors
 *  return the all-null shape: liveness is decoration, never a page break. */
export async function tvAiringInfo(tvId: number): Promise<TvAiringInfo> {
  "use cache";
  cacheLife("days");
  cacheTag(`tv-status:${tvId}`);
  try {
    const d = await tmdb.tvAiring(tvId);
    const n = d.next_episode_to_air;
    return {
      status: d.status ?? null,
      lastAirDate: d.last_air_date ?? null,
      nextEpisode: n
        ? {
            seasonNumber: n.season_number ?? 0,
            episodeNumber: n.episode_number ?? 0,
            name: n.name ?? null,
            airDate: n.air_date ?? null,
          }
        : null,
    };
  } catch {
    return NULL_INFO;
  }
}
```

Update the existing import from `@/lib/tv-status` to the one shown above (it gains `TvAiringInfo`), delete the old `tvStatus` function, and change the one call site inside `tvStatusBadges` from `statusBadge(await tvStatus(i.tmdbId))` to `statusBadge((await tvAiringInfo(i.tmdbId)).status)`.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/services/tv-status.test.ts src/lib/tv-status.test.ts`
Expected: PASS, 10 tests across both files.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit` (expect no output)

```bash
git add src/services/tv-status.ts src/services/tv-status.test.ts
git commit -m "Widen the daily airing cache to carry the next episode"
```

---

### Task 3: Next unwatched

**Files:**
- Create: `src/lib/watch-progress.ts`
- Create: `src/lib/watch-progress.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/watch-progress.test.ts`:

```ts
import { test, expect } from "vitest";
import { nextUnwatched, watchKey } from "./watch-progress";

const seasons = [
  { seasonNumber: 1, episodeCount: 3 },
  { seasonNumber: 2, episodeCount: 2 },
];
const set = (...pairs: [number, number][]) => new Set(pairs.map(([s, e]) => watchKey(s, e)));

test("an empty set starts at the beginning", () => {
  expect(nextUnwatched(set(), seasons)).toEqual({ season: 1, episode: 1 });
});

test("a mid-season gap is the next episode", () => {
  expect(nextUnwatched(set([1, 1], [1, 3]), seasons)).toEqual({ season: 1, episode: 2 });
});

test("a finished season rolls into the next", () => {
  expect(nextUnwatched(set([1, 1], [1, 2], [1, 3]), seasons)).toEqual({ season: 2, episode: 1 });
});

test("everything watched returns null", () => {
  expect(nextUnwatched(set([1, 1], [1, 2], [1, 3], [2, 1], [2, 2]), seasons)).toBeNull();
});

test("specials are ignored on both sides", () => {
  const withSpecials = [{ seasonNumber: 0, episodeCount: 5 }, ...seasons];
  expect(nextUnwatched(set([0, 1]), withSpecials)).toEqual({ season: 1, episode: 1 });
});

test("seasons arriving out of order are walked in order", () => {
  expect(nextUnwatched(set([1, 1], [1, 2], [1, 3]), [...seasons].reverse())).toEqual({ season: 2, episode: 1 });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/watch-progress.test.ts`
Expected: FAIL, cannot resolve `./watch-progress`.

- [ ] **Step 3: Implement**

Create `src/lib/watch-progress.ts`:

```ts
/** The key shape shared with the season accordion's watched set. */
export function watchKey(season: number, episode: number): string {
  return `${season}:${episode}`;
}

/**
 * First episode not in the watched set, walking real seasons in order. Episode
 * numbers are 1..episodeCount, which is how TMDB numbers them, so no episode
 * list fetch is needed. Specials (season 0) are excluded to match the
 * accordion, which hides them. Null when everything listed is watched.
 */
export function nextUnwatched(
  watched: Set<string>,
  seasons: { seasonNumber: number; episodeCount: number }[],
): { season: number; episode: number } | null {
  const real = seasons.filter((s) => s.seasonNumber > 0).sort((a, b) => a.seasonNumber - b.seasonNumber);
  for (const s of real) {
    for (let e = 1; e <= s.episodeCount; e++) {
      if (!watched.has(watchKey(s.seasonNumber, e))) return { season: s.seasonNumber, episode: e };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/lib/watch-progress.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/watch-progress.ts src/lib/watch-progress.test.ts
git commit -m "Compute the next unwatched episode from season counts"
```

---

### Task 4: Find a GB broadcast for the air date

**Files:**
- Modify: `src/services/guide.ts`
- Create: `src/services/guide.test.ts`

- [ ] **Step 1: Write the failing test**

The scan is pure over `GuideChannel[]`; only the wrapper touches the cached schedule, so the pure part is what gets tested. Create `src/services/guide.test.ts`:

```ts
import { test, expect } from "vitest";
import { findBroadcast, type GuideChannel } from "./guide";

const entry = (href: string, time: string | null) => ({
  id: 1, time, airstamp: null, showName: "x", season: null, episode: null,
  episodeTitle: null, synopsis: null, runtime: null, href,
});
const guide: GuideChannel[] = [
  { channel: "BBC One", entries: [entry("/title/tv/999-other-show", "20:00")] },
  { channel: "Channel 4", entries: [entry("/title/tv/1396-breaking-bad#s3e5", "21:00")] },
];

test("finds the channel and time for a show by its tmdb id", () => {
  expect(findBroadcast(guide, 1396)).toEqual({ channel: "Channel 4", time: "21:00" });
});

test("does not match a different id sharing a prefix", () => {
  expect(findBroadcast(guide, 139)).toBeNull();
});

test("null when the show is not in the schedule", () => {
  expect(findBroadcast(guide, 42)).toBeNull();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/services/guide.test.ts`
Expected: FAIL, `findBroadcast` is not exported.

- [ ] **Step 3: Implement**

Append to `src/services/guide.ts`:

```ts
export interface Broadcast {
  channel: string;
  /** Channel-local clock time, e.g. "21:00", when the guide has it. */
  time: string | null;
}

/** Pure scan of one day's guide for a show, matched by the tmdb id its entries
 *  embed in their hrefs ("/title/tv/1396-slug"). The trailing hyphen is what
 *  stops id 139 matching 1396. */
export function findBroadcast(channels: GuideChannel[], tmdbId: number): Broadcast | null {
  const prefix = `/title/tv/${tmdbId}-`;
  for (const c of channels) {
    for (const e of c.entries) {
      if (e.href.startsWith(prefix)) return { channel: c.channel, time: e.time };
    }
  }
  return null;
}

/** GB broadcast of a show on one date, if the guide lists it. Reads the same
 *  hours-cached schedule the guide page renders, so this adds no TVmaze volume
 *  on a warm day; a cold date costs the one fetch the guide page would pay
 *  anyway. Null on any failure: the channel line is decoration. */
export async function broadcastFor(tmdbId: number, dateYmd: string): Promise<Broadcast | null> {
  try {
    return findBroadcast(await getSchedule("GB", dateYmd), tmdbId);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/services/guide.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit` (expect no output)

```bash
git add src/services/guide.ts src/services/guide.test.ts
git commit -m "Look up a show's GB broadcast for one guide day"
```

---

### Task 5: The AiringBanner

**Files:**
- Create: `src/components/catalog/AiringBanner.tsx`
- Modify: `src/app/title/[mediaType]/[idSlug]/page.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/catalog/AiringBanner.tsx`:

```tsx
import { tvAiringInfo } from "@/services/tv-status";
import { broadcastFor } from "@/services/guide";
import { airingLabel } from "@/lib/tv-status";
import { yearFromDate } from "@/lib/slug";
import { shiftYmd } from "@/lib/release";

/**
 * One line under the hero answering "is this show still alive?". Server
 * rendered for everyone from the daily airing cache; every failure path
 * renders nothing rather than a broken banner. The GB channel line is an
 * enhancement that only appears when the guide lists the air date.
 */
export async function AiringBanner({ tvId, todayYmd }: { tvId: number; todayYmd: string }) {
  const info = await tvAiringInfo(tvId);
  const label = airingLabel(info, todayYmd);
  if (!label) return null;

  const ep = info.nextEpisode;
  let text: string;
  let tone = "text-text";
  switch (label.kind) {
    case "next-episode": {
      const epName = ep?.name ? ` '${ep.name}'` : "";
      text = `New episode ${label.when} · S${ep?.seasonNumber} E${ep?.episodeNumber}${epName}`;
      tone = "text-accent-text";
      break;
    }
    case "returning":
      text = "Returning series · next episode not yet scheduled";
      break;
    case "in-production":
      text = "In production";
      break;
    case "ended": {
      const year = yearFromDate(info.lastAirDate);
      text = year ? `Ended · final episode aired ${year}` : "Ended";
      break;
    }
    case "cancelled":
      text = "Cancelled";
      tone = "text-danger";
      break;
  }

  // Only worth a guide lookup when the episode airs inside the next week: the
  // guide realistically lists near dates, and a far-future date would pay a
  // cold TVmaze fetch for a day that is almost certainly empty. YMD strings
  // compare lexicographically, so this is a plain string comparison.
  const broadcast =
    label.kind === "next-episode" && ep?.airDate && ep.airDate < shiftYmd(todayYmd, 7)
      ? await broadcastFor(tvId, ep.airDate)
      : null;

  return (
    <p className={`mt-2 text-sm font-medium ${tone}`}>
      {text}
      {broadcast && (
        <span className="text-text-muted">
          {" "}· {broadcast.time ? `${broadcast.time} on ` : "on "}
          {broadcast.channel}
        </span>
      )}
    </p>
  );
}
```

- [ ] **Step 2: Wire it into the page**

In `src/app/title/[mediaType]/[idSlug]/page.tsx`, add the import beside the other catalog component imports:

```tsx
import { AiringBanner } from "@/components/catalog/AiringBanner";
```

The page already computes `todayYmd`. Find the hero meta row's closing tag, which sits directly above the genres block:

```tsx
            </div>

            {/* Genres */}
```

and insert the banner between them, so it reads:

```tsx
            </div>

            {mediaType === "tv" && (
              <Suspense fallback={null}>
                <AiringBanner tvId={id} todayYmd={todayYmd} />
              </Suspense>
            )}

            {/* Genres */}
```

`Suspense` is already imported in this file.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (expect no output)
Run: `npx eslint src/components/catalog/AiringBanner.tsx "src/app/title/[mediaType]/[idSlug]/page.tsx"` (expect no output)
Run: `npx next build` (expect "Compiled successfully" and the TypeScript phase passing)

- [ ] **Step 4: Commit**

```bash
git add src/components/catalog/AiringBanner.tsx "src/app/title/[mediaType]/[idSlug]/page.tsx"
git commit -m "Answer whether a show is still alive on its own page"
```

---

### Task 6: The WatchProgress summary

**Files:**
- Create: `src/components/catalog/WatchProgress.tsx`
- Modify: `src/app/title/[mediaType]/[idSlug]/page.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/catalog/WatchProgress.tsx`:

```tsx
import Link from "next/link";
import { getWatchedEpisodes } from "@/services/episode-watches";
import { nextUnwatched, watchKey } from "@/lib/watch-progress";
import type { SeasonSummary } from "@/lib/tmdb/episodes";

/**
 * "14 of 62 episodes · Next up: S2 E3" above the season list. Signed-in only,
 * and renders nothing until at least one episode is marked watched, so the
 * common case costs nothing and shows nothing. One indexed DB read; the season
 * episode counts come from metadata already on the page. The total includes a
 * currently airing season's unaired remainder, accepted in the spec: fixing it
 * needs a fetch this feature refuses to add.
 */
export async function WatchProgress({
  userId,
  tvId,
  seasons,
}: {
  userId: string | null;
  tvId: number;
  seasons: SeasonSummary[];
}) {
  if (!userId || seasons.length === 0) return null;

  const rows = await getWatchedEpisodes(userId, tvId);
  if (rows.length === 0) return null;

  const real = seasons.filter((s) => s.seasonNumber > 0);
  const total = real.reduce((n, s) => n + s.episodeCount, 0);
  if (total === 0) return null;

  const watched = new Set(rows.map((r) => watchKey(r.season, r.episode)));
  // Count only watches that map onto listed real seasons, so a stale mark on a
  // since-removed episode cannot push the bar past 100 percent.
  const counted = rows.filter((r) => {
    const s = real.find((x) => x.seasonNumber === r.season);
    return s != null && r.episode >= 1 && r.episode <= s.episodeCount;
  }).length;
  const next = nextUnwatched(watched, real);
  const pct = Math.min(100, Math.round((counted / total) * 100));

  return (
    <div className="mb-4 rounded-md border border-border bg-surface-raised px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-text">
          {counted} of {total} episodes
        </span>
        {next ? (
          <Link href={`#s${next.season}e${next.episode}`} className="font-medium text-accent-text hover:underline">
            Next up: S{next.season} E{next.episode}
          </Link>
        ) : (
          <span className="font-medium text-success">All caught up</span>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-overlay">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```

`text-success` is a real theme token (`--color-success` in `globals.css`), verified while writing this plan.

- [ ] **Step 2: Wire it into the page**

In `src/app/title/[mediaType]/[idSlug]/page.tsx`, add the import:

```tsx
import { WatchProgress } from "@/components/catalog/WatchProgress";
```

In the Episodes section, insert above `<EpisodeFinder tvId={id} />`:

```tsx
              <Suspense fallback={null}>
                <WatchProgress userId={viewer?.id ?? null} tvId={id} seasons={seasons} />
              </Suspense>
```

`viewer` is already in scope from the top of the page.

- [ ] **Step 3: Verify the whole feature**

Run: `npx tsc --noEmit` (expect no output)
Run: `npx eslint src/components/catalog/WatchProgress.tsx "src/app/title/[mediaType]/[idSlug]/page.tsx"` (expect no output)
Run: `npx vitest run src/lib/tv-status.test.ts src/services/tv-status.test.ts src/lib/watch-progress.test.ts src/services/guide.test.ts` (expect 19 tests passing)
Run: `npx next build` (expect "Compiled successfully" and the TypeScript phase passing)

- [ ] **Step 4: Commit**

```bash
git add src/components/catalog/WatchProgress.tsx "src/app/title/[mediaType]/[idSlug]/page.tsx"
git commit -m "Show where a signed-in viewer is in a show"
```

---

### Task 7: Verify live after deploy

**Files:** none changed.

- [ ] **Step 1: On a returning show** (for example `/title/tv/1396-breaking-bad` is ended; use a currently airing show from the home page): the banner shows the next episode with a sensible date word, and on an ended show it reads "Ended · final episode aired {year}".

- [ ] **Step 2: Signed in, on a show with some episodes marked watched:** the progress card shows the right counts, and "Next up" scrolls to and flashes the episode row (the accordion's existing deep-link behaviour).

- [ ] **Step 3: Signed out:** no progress card renders, and the banner still does.
