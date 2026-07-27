# Mood TV Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TV tab to every mood page so users can browse curated TV shows alongside the existing curated movies, leaving the home page rotation movie-only.

**Architecture:** A new optional `manualTv` array on each `Mood` holds hand-picked TMDB TV ids; its presence is the single switch that enables the TV tab. `/mood/[slug]` stays movies and a new `/mood/[slug]/tv` route serves TV, so each tab is separately indexable and cacheable. Both routes render one shared server component. TV lists are hand-curated because TMDB's TV genre vocabulary lacks Romance, Horror, Thriller, Action, Adventure and Sci-Fi, which makes Discover queries unusable for TV (see the design doc for the measured evidence).

**Tech Stack:** Next.js 16 App Router, Cache Components (`'use cache'`, `cacheLife`, `cacheTag`), TypeScript, Vitest, Tailwind, TMDB API.

**Spec:** `docs/superpowers/specs/2026-07-27-mood-tv-tabs-design.md`

---

## House rules for this plan

- **No em dashes** in any string that reaches a user (page copy, metadata titles, blurbs, labels). Use commas, colons or parentheses. Before any Write/Edit that adds copy, check the literal string you are about to write. This is a standing project rule.
- Do not add a `Co-Authored-By: Claude` trailer to commits.
- Never guess a TMDB id. Every id in this plan was verified by direct API lookup on 2026-07-27.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/moods.ts` (modify) | Mood data. Adds `manualTv`, `blurbTv` fields, the 20 curated TV lists, and the pure `hasTvTab` / `moodBlurb` helpers. |
| `src/lib/moods.test.ts` (modify) | Unit tests for the new helpers plus data-integrity tests over the TV lists. |
| `src/lib/tmdb/mood-card.ts` (create) | Pure `toMoodCard(mediaType, id, brief)` mapper. Extracted so card shaping is testable without the `'use cache'` boundary. |
| `src/lib/tmdb/mood-card.test.ts` (create) | Unit tests for `toMoodCard`. |
| `src/services/moods.ts` (modify) | Cached orchestration. `getMoodTitles` gains a `mediaType` param and a TV fetch path. |
| `src/components/catalog/MoodTabs.tsx` (create) | Movies / TV tab links, rendered only when the mood has both. |
| `src/app/mood/[slug]/MoodView.tsx` (create) | Shared server component rendering header, tabs and grid for a given media type. |
| `src/app/mood/[slug]/page.tsx` (modify) | Movies tab. Delegates to `MoodView`. Also fixes the em dash in its metadata title. |
| `src/app/mood/[slug]/tv/page.tsx` (create) | TV tab. Delegates to `MoodView`, 404s when the mood has no TV list. |

---

## Task 1: Mood schema and pure helpers

**Files:**
- Modify: `src/lib/moods.ts`
- Test: `src/lib/moods.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/moods.test.ts`:

```ts
import { hasTvTab, moodBlurb, type Mood } from "./moods";

const base: Mood = {
  slug: "x",
  label: "X",
  emoji: "x",
  blurb: "movie blurb",
  kind: "mood",
};

test("hasTvTab is false when there is no TV list", () => {
  expect(hasTvTab(base)).toBe(false);
  expect(hasTvTab({ ...base, manualTv: [] })).toBe(false);
});

test("hasTvTab is true when a TV list is present", () => {
  expect(hasTvTab({ ...base, manualTv: [1, 2] })).toBe(true);
});

test("moodBlurb falls back to the shared blurb for TV", () => {
  expect(moodBlurb(base, "tv")).toBe("movie blurb");
});

test("moodBlurb prefers blurbTv for TV only", () => {
  const m = { ...base, blurbTv: "tv blurb" };
  expect(moodBlurb(m, "tv")).toBe("tv blurb");
  expect(moodBlurb(m, "movie")).toBe("movie blurb");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/moods.test.ts`
Expected: FAIL, `hasTvTab` and `moodBlurb` are not exported.

- [ ] **Step 3: Add the fields and helpers**

In `src/lib/moods.ts`, extend the `Mood` interface (leave every existing field as-is):

```ts
  /** Hand-picked TMDB movie ids, in curated order. Takes precedence over `query`. */
  manual?: number[];
  /** Hand-picked TMDB TV ids, in curated order. Presence enables the mood's TV tab.
   *  TV is always curated: TMDB's TV genre vocabulary has no Romance/Horror/Thriller/
   *  Action/Adventure/Sci-Fi, so Discover queries return 0-2 results for these moods. */
  manualTv?: number[];
  /** Blurb override for the TV tab, when the shared blurb does not fit shows. */
  blurbTv?: string;
```

Then add below `getMoodBySlug`:

```ts
export type MoodMedia = "movie" | "tv";

/** A mood shows its TV tab only once it has a curated TV list. */
export function hasTvTab(mood: Mood): boolean {
  return (mood.manualTv?.length ?? 0) > 0;
}

/** Blurb for a tab: TV falls back to the shared blurb unless overridden. */
export function moodBlurb(mood: Mood, media: MoodMedia): string {
  return media === "tv" ? (mood.blurbTv ?? mood.blurb) : mood.blurb;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/moods.test.ts`
Expected: PASS, all tests including the 5 pre-existing rotation tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/moods.ts src/lib/moods.test.ts
git commit -m "Add manualTv/blurbTv mood fields and tab helpers"
```

---

## Task 2: Curated TV lists

Every id below was verified against TMDB on 2026-07-27. Add each `manualTv` (and the one `blurbTv`) to the matching mood object in `src/lib/moods.ts`. Do not reorder or alter any existing `manual` array.

**Files:**
- Modify: `src/lib/moods.ts`
- Test: `src/lib/moods.test.ts`

- [ ] **Step 1: Write the failing data-integrity tests**

Append to `src/lib/moods.test.ts`:

```ts
import { MOODS } from "./moods";

const withTv = MOODS.filter((m) => m.manualTv?.length);

test("21 of the 22 moods have a curated TV list", () => {
  expect(MOODS).toHaveLength(22);
  expect(withTv).toHaveLength(21);
});

test("festive-favourites has no TV list", () => {
  expect(MOODS.find((m) => m.slug === "festive-favourites")?.manualTv).toBeUndefined();
});

test("every TV list clears the one-row visual floor", () => {
  for (const m of withTv) expect(m.manualTv!.length).toBeGreaterThanOrEqual(6);
});

test("no TV list contains duplicate ids", () => {
  for (const m of withTv) {
    expect(new Set(m.manualTv!).size, `${m.slug} has duplicate ids`).toBe(m.manualTv!.length);
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/moods.test.ts`
Expected: FAIL, `expected [] to have length 21`.

- [ ] **Step 3: Add each list**

Add these properties to the matching mood objects:

```ts
// cosy-night-in
manualTv: [4586, 61662, 97546, 8592, 48891, 1421, 1420, 107113, 32726, 70785, 39793, 66134, 61828, 2430, 124834],
// Gilmore Girls, Schitt's Creek, Ted Lasso, Parks and Rec, Brooklyn Nine-Nine,
// Modern Family, New Girl, Only Murders, Bob's Burgers, Anne with an E, Call the
// Midwife, The Durrells, Detectorists, Doc Martin, Heartstopper.

// edge-of-your-seat
manualTv: [1396, 60059, 69740, 67744, 43982, 1427, 34415, 49010, 1407, 2288, 1973, 1405, 70453, 39852, 80307, 78191],
// Breaking Bad, Better Call Saul, Ozark, Mindhunter, Line of Duty, Broadchurch,
// The Killing, The Fall, Homeland, Prison Break, 24, Dexter, Sharp Objects, The
// Sinner, Bodyguard, You.

// need-a-laugh
manualTv: [2316, 8592, 48891, 2710, 4589, 18347, 4608, 1400, 1668, 4546, 2490, 815, 2207, 62649, 83631, 126027],
// The Office, Parks and Rec, Brooklyn Nine-Nine, It's Always Sunny, Arrested
// Development, Community, 30 Rock, Seinfeld, Friends, Curb Your Enthusiasm, The IT
// Crowd, Peep Show, Fawlty Towers, Superstore, What We Do in the Shadows, Ghosts.

// a-good-cry
manualTv: [67136, 1274, 54344, 81355, 89905, 79410, 46619, 240667, 111141, 99581, 136311, 1416, 39793, 46880],
// This Is Us, Six Feet Under, The Leftovers, When They See Us, Normal People, After
// Life, Rectify, One Day, Maid, Unorthodox, Shrinking, Grey's Anatomy, Call the
// Midwife, The Fosters.

// mind-benders
manualTv: [70523, 95396, 63247, 1920, 4607, 1705, 67195, 69061, 81349, 86340, 73411, 84977, 63646, 93784, 90669, 894],
// Dark, Severance, Westworld, Twin Peaks, Lost, Fringe, Legion, The OA, Devs,
// Undone, Maniac, Russian Doll, Counterpart, Tales from the Loop, 1899, The Prisoner.

// so-bad-its-good
manualTv: [69050, 2384, 2119, 3291, 12751, 3318, 2898, 237],
// Riverdale, Knight Rider, Airwolf, Manimal, Automan, Street Hawk, Small Wonder,
// Mortal Kombat: Conquest. Shorter than the movie list on purpose: the TV canon here
// is thin, and this list is expected to grow.

// b-movie-mashups
manualTv: [61345, 62264, 65988, 65820, 71693, 62413, 62517, 58811, 10268, 73536, 39351, 1310, 67726],
// Z Nation, Ash vs Evil Dead, Wynonna Earp, Van Helsing, Blood Drive, Killjoys, Zoo,
// Helix, Primeval, Dinotopia, Grimm, Sanctuary, Beyond.

// popcorn-action
manualTv: [1973, 32573, 41727, 73544, 108978, 73375, 76479, 77169, 71790, 32798, 2919, 47450, 1412, 67178, 110492, 205715],
// 24, Strike Back, Banshee, Warrior, Reacher, Jack Ryan, The Boys, Cobra Kai,
// S.W.A.T., Hawaii Five-0, Burn Notice, Into the Badlands, Arrow, The Punisher,
// Peacemaker, Gen V.

// grindhouse
manualTv: [46296, 47665, 41727, 62264, 64230, 60626, 42295, 71693, 75663, 129418, 72339, 1409, 126118, 40008, 47640, 54671],
// Spartacus, Black Sails, Banshee, Ash vs Evil Dead, Preacher, From Dusk Till Dawn,
// Hemlock Grove, Blood Drive, Deadly Class, Brand New Cherry Flavor, Happy!, Sons of
// Anarchy, Chapelwaite, Hannibal, The Strain, Penny Dreadful.

// date-night
manualTv: [91239, 196454, 56570, 62084, 92875, 89905, 240667, 88324, 91602, 61418, 82596, 100883, 124834, 62668, 250923, 194766],
// Bridgerton, Queen Charlotte, Outlander, Poldark, Sanditon, Normal People, One Day,
// Virgin River, Modern Love, Jane the Virgin, Emily in Paris, Never Have I Ever,
// Heartstopper, Lovesick, Nobody Wants This, The Summer I Turned Pretty.

// epic-adventures
manualTv: [1399, 94997, 84773, 44217, 63333, 1891, 126308, 70593, 71912, 82452, 46296, 47665, 71914, 70484, 56570],
// Game of Thrones, House of the Dragon, Rings of Power, Vikings, The Last Kingdom,
// Rome, Shogun, Kingdom, The Witcher, Avatar: The Last Airbender, Spartacus, Black
// Sails, The Wheel of Time, Britannia, Outlander.

// family-movie-night
manualTv: [82728, 82452, 40075, 1877, 72350, 15260, 92685, 60554, 85349, 68267, 74728, 95599, 115577, 82856],
// Bluey, Avatar: The Last Airbender, Gravity Falls, Phineas and Ferb, DuckTales,
// Adventure Time, The Owl House, Star Wars Rebels, Amphibia, Trollhunters, Carmen
// Sandiego, Kipo, Sonic Prime, The Mandalorian.

// true-stories
manualTv: [87108, 65494, 4613, 81355, 63351, 67744, 64513, 91275, 72039, 82883, 74140, 122066, 110695, 114925, 95665, 155537],
// Chernobyl, The Crown, Band of Brothers, When They See Us, Narcos, Mindhunter,
// American Crime Story, Unbelievable, Escape at Dannemora, The Act, Waco, The
// Dropout, Dopesick, Pam & Tommy, Inventing Anna, Black Bird.

// inspirational
manualTv: [97546, 4278, 126929, 97401, 125935, 76922, 85077, 2243, 2440, 4550, 1781, 61865],
// Ted Lasso, Friday Night Lights, Welcome to Wrexham, Cheer, Abbott Elementary,
// Queer Eye, The Chosen, Touched by an Angel, Highway to Heaven, 7th Heaven, Little
// House on the Prairie, When Calls the Heart.

// classic-hollywood  (also add blurbTv, see below)
manualTv: [2730, 4439, 5273, 6357, 5133, 106, 2132, 4177, 3713, 1018, 10952, 10980, 2774, 10083, 4357, 253],
// I Love Lucy, The Honeymooners, Alfred Hitchcock Presents, The Twilight Zone, Leave
// It to Beaver, The Andy Griffith Show, The Dick Van Dyke Show, Perry Mason,
// Gunsmoke, Bonanza, Rawhide, Have Gun Will Travel, The Untouchables, The Fugitive,
// Mission: Impossible, Star Trek. Several are low-vote on TMDB but canonical for the
// era, so the usual vote heuristic was relaxed here deliberately.
blurbTv: "Television's golden age: the shows that invented the medium, from the 1950s to the 1960s.",

// teen-outsiders
manualTv: [1101, 2382, 2327, 2673, 95, 1432, 1948, 900, 85552, 81356, 124834, 100883, 76148, 76747, 85702, 117488],
// My So-Called Life, Freaks and Geeks, Dawson's Creek, The O.C., Buffy, Veronica
// Mars, Degrassi, Skins, Euphoria, Sex Education, Heartstopper, Never Have I Ever,
// Derry Girls, On My Block, PEN15, Yellowjackets.

// martial-arts-underdogs
manualTv: [77169, 73544, 1472, 47450, 86752, 62127, 42705, 77939, 80623, 90660, 225180],
// Cobra Kai, Warrior, Kung Fu (1972), Into the Badlands, Wu Assassins, Iron Fist,
// Fighting Spirit, Megalobox, Baki, Kengan Ashura, Blue Eye Samurai. Leans more on
// anime than the movie list does, which is the only way the underdog-fighter shape
// exists in long-form TV.

// dystopian-futures
manualTv: [69478, 42009, 48866, 79680, 125988, 106379, 62017, 63247, 93405, 87104, 46511, 100088, 108545, 62858, 93289, 90972],
// The Handmaid's Tale, Black Mirror, The 100, Snowpiercer, Silo, Fallout, The Man in
// the High Castle, Westworld, Squid Game, Years and Years, Utopia, The Last of Us, 3
// Body Problem, Colony, Brave New World, Station Eleven.

// spooky-season
manualTv: [72844, 109958, 1413, 66732, 1402, 97400, 79242, 54671, 75191, 71116, 124364, 128098, 40008, 16118, 86850, 92916],
// The Haunting of Hill House, Bly Manor, American Horror Story, Stranger Things, The
// Walking Dead, Midnight Mass, Chilling Adventures of Sabrina, Penny Dreadful, The
// Terror, Castle Rock, From, Interview with the Vampire, Hannibal, Salem's Lot,
// Dracula, Marianne.

// valentines-picks
manualTv: [91239, 196454, 56570, 62084, 92875, 89905, 240667, 61418, 91602, 62668, 124834, 100883, 88324, 82596, 194766],
// Bridgerton, Queen Charlotte, Outlander, Poldark, Sanditon, Normal People, One Day,
// Jane the Virgin, Modern Love, Lovesick, Heartstopper, Never Have I Ever, Virgin
// River, Emily in Paris, The Summer I Turned Pretty.

// summer-blockbusters
manualTv: [1399, 94997, 66732, 76479, 82856, 84958, 85271, 202555, 71912, 119051, 106379, 95557, 94605, 111110, 110492, 108978],
// Game of Thrones, House of the Dragon, Stranger Things, The Boys, The Mandalorian,
// Loki, WandaVision, Daredevil: Born Again, The Witcher, Wednesday, Fallout,
// Invincible, Arcane, One Piece, Peacemaker, Reacher.
```

- [ ] **Step 4: Run tests and the em dash check**

```bash
npx vitest run src/lib/moods.test.ts
```
Expected: PASS.

```bash
grep -n "—" src/lib/moods.ts
```
Expected: only the 4 pre-existing matches (the `MoodQuery` field comments and the two near "Occasions"). If the `blurbTv` line appears, replace its em dash with a colon.

- [ ] **Step 5: Commit**

```bash
git add src/lib/moods.ts src/lib/moods.test.ts
git commit -m "Curate TV lists for 20 moods"
```

---

## Task 3: Pure card mapper

`manualMovie` currently lives inside the `'use cache'` module, which makes it awkward to unit test. Extract a pure mapper that both media types share.

**Files:**
- Create: `src/lib/tmdb/mood-card.ts`
- Test: `src/lib/tmdb/mood-card.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/tmdb/mood-card.test.ts`:

```ts
import { test, expect } from "vitest";
import { toMoodCard } from "./mood-card";

test("maps a movie brief to a card", () => {
  const c = toMoodCard("movie", 19, {
    title: "Metropolis",
    release_date: "1927-01-10",
    poster_path: "/p.jpg",
  });
  expect(c).toMatchObject({ mediaType: "movie", tmdbId: 19, title: "Metropolis", year: 1927 });
  expect(c!.href).toBe("/title/movie/19-metropolis-1927");
});

test("maps a TV brief using name and first_air_date", () => {
  const c = toMoodCard("tv", 1396, {
    name: "Breaking Bad",
    first_air_date: "2008-01-20",
    poster_path: null,
  });
  expect(c).toMatchObject({ mediaType: "tv", tmdbId: 1396, title: "Breaking Bad", year: 2008 });
  expect(c!.href.startsWith("/title/tv/1396-")).toBe(true);
});

test("returns null for a missing brief", () => {
  expect(toMoodCard("tv", 1, null)).toBeNull();
});

test("tolerates a brief with no date", () => {
  const c = toMoodCard("tv", 2, { name: "X", poster_path: null });
  expect(c!.year).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/tmdb/mood-card.test.ts`
Expected: FAIL, cannot resolve `./mood-card`.

- [ ] **Step 3: Write the mapper**

Create `src/lib/tmdb/mood-card.ts`:

```ts
import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug } from "@/lib/slug";
import type { TitleResult } from "@/lib/tmdb/transform";
import type { MoodMedia } from "@/lib/moods";

/** Minimal shape both `titleBrief` responses share. */
export interface MoodBrief {
  title?: string | null;
  name?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  poster_path?: string | null;
}

/** Pure: shape a TMDB brief into a mood card. Returns null when the fetch failed. */
export function toMoodCard(media: MoodMedia, id: number, b: MoodBrief | null): TitleResult | null {
  if (!b) return null;
  const name = b.title ?? b.name ?? "Untitled";
  const date = b.release_date ?? b.first_air_date ?? null;
  const parsed = date && date.length >= 4 ? Number(date.slice(0, 4)) : null;
  const year = parsed != null && Number.isFinite(parsed) ? parsed : null;
  return {
    kind: "title",
    mediaType: media,
    tmdbId: id,
    title: name,
    year,
    releaseDate: date,
    posterUrl: posterUrl(b.poster_path ?? null),
    href: `/title/${media}/${id}-${titleSlug(name, date)}`,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/tmdb/mood-card.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tmdb/mood-card.ts src/lib/tmdb/mood-card.test.ts
git commit -m "Extract pure mood card mapper"
```

---

## Task 4: Service supports both media types

**Files:**
- Modify: `src/services/moods.ts`

- [ ] **Step 1: Replace `manualMovie` with a media-aware fetch**

Delete the `manualMovie` function and replace it with:

```ts
import { toMoodCard } from "@/lib/tmdb/mood-card";
import { getMoodBySlug, type MoodQuery, type MoodMedia } from "@/lib/moods";

/** Build a card from a hand-picked TMDB id (lightweight fetch). */
async function manualTitle(media: MoodMedia, id: number): Promise<TitleResult | null> {
  const b = await tmdb.titleBrief(media, id).catch(() => null);
  return toMoodCard(media, id, b);
}
```

Remove the now-unused `posterUrl` and `titleSlug` imports if nothing else in the file uses them.

- [ ] **Step 2: Add the `media` parameter to `getMoodTitles`**

Change the signature and cache tag, and branch the seed:

```ts
export async function getMoodTitles(
  slug: string,
  media: MoodMedia = "movie",
  pages = 1,
): Promise<TitleResult[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(`mood:${slug}:${media}`);

  const mood = getMoodBySlug(slug);
  if (!mood) return [];

  const seen = new Set<number>();
  const out: TitleResult[] = [];

  const seed = media === "tv" ? mood.manualTv : mood.manual;
  if (seed?.length) {
    const cards = await Promise.all(seed.map((id) => manualTitle(media, id)));
    for (const c of cards) {
      if (c && !seen.has(c.tmdbId)) {
        seen.add(c.tmdbId);
        out.push(c);
      }
    }
  }

  // Dynamic Discover fill is movie-only: TMDB's TV genre vocabulary lacks the genres
  // these queries rely on, so a TV fill returns 0-2 results. TV moods are curated.
  if (media === "movie" && mood.query) {
    // ...leave the existing Discover block exactly as it is...
  }

  return out;
}
```

Keep the entire existing Discover block unchanged inside the new `media === "movie" &&` guard.

- [ ] **Step 3: Update the one existing caller**

`src/app/mood/[slug]/page.tsx` currently calls `getMoodTitles(slug, 3)`. That now means "media = 3", so it must become `getMoodTitles(slug, "movie", 3)`. Task 6 rewrites this file, but make the change now so the build stays green.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Use a generous timeout, this can take over 2 minutes on this machine.

- [ ] **Step 5: Commit**

```bash
git add src/services/moods.ts src/app/mood/[slug]/page.tsx
git commit -m "Support movie and TV media types in getMoodTitles"
```

---

## Task 5: Tab component

**Files:**
- Create: `src/components/catalog/MoodTabs.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/catalog/MoodTabs.tsx`:

```tsx
import Link from "next/link";
import type { MoodMedia } from "@/lib/moods";

/** Movies / TV switcher. Rendered only for moods that have a curated TV list. */
export function MoodTabs({ slug, active }: { slug: string; active: MoodMedia }) {
  const tabs: { media: MoodMedia; label: string; href: string }[] = [
    { media: "movie", label: "Movies", href: `/mood/${slug}` },
    { media: "tv", label: "TV shows", href: `/mood/${slug}/tv` },
  ];
  return (
    <nav aria-label="Media type" className="flex gap-1 border-b border-border">
      {tabs.map((t) => {
        const on = t.media === active;
        return (
          <Link
            key={t.media}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={
              on
                ? "border-b-2 border-accent px-4 py-2 text-sm font-semibold text-text"
                : "border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-muted hover:text-text"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

`border-border` maps to `--color-border: #2a2f3e` in `src/app/globals.css` and is already used elsewhere in `src/components`, so it needs no substitution. `text-accent-text` is the AA-compliant accent token, do not use `text-accent` for text.

- [ ] **Step 2: Check for em dashes**

Run: `grep -n "—" src/components/catalog/MoodTabs.tsx`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add src/components/catalog/MoodTabs.tsx
git commit -m "Add mood media tabs"
```

---

## Task 6: Shared view and movies route

**Files:**
- Create: `src/app/mood/[slug]/MoodView.tsx`
- Modify: `src/app/mood/[slug]/page.tsx`

- [ ] **Step 1: Extract the shared view**

Create `src/app/mood/[slug]/MoodView.tsx` holding the current page body, parameterised by media:

```tsx
import Link from "next/link";
import { hasTvTab, moodBlurb, type Mood, type MoodMedia } from "@/lib/moods";
import { getMoodTitles } from "@/services/moods";
import { cardActionContext, favouriteProp, watchlistProp } from "@/services/favourites";
import { TitleCard } from "@/components/catalog/TitleCard";
import { MoodTabs } from "@/components/catalog/MoodTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { upcomingLabel } from "@/lib/release";

export async function MoodView({ mood, media }: { mood: Mood; media: MoodMedia }) {
  const [items, ctx] = await Promise.all([
    getMoodTitles(mood.slug, media, 3),
    cardActionContext(),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/moods" className="text-sm font-medium text-accent-text hover:underline">
          ← All moods
        </Link>
        <h1 className="text-2xl font-bold text-text">
          <span aria-hidden className="mr-2">{mood.emoji}</span>
          {mood.label}
        </h1>
        <p className="text-sm text-text-muted">{moodBlurb(mood, media)}</p>
      </header>

      {hasTvTab(mood) && <MoodTabs slug={mood.slug} active={media} />}

      {items.length === 0 ? (
        <EmptyState title="Nothing to show" description="No titles matched this mood right now." />
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {items.map((t) => (
            <TitleCard
              key={t.tmdbId}
              href={t.href}
              title={t.title}
              year={t.year}
              posterUrl={t.posterUrl}
              upcoming={upcomingLabel(t.releaseDate)}
              favourite={favouriteProp(ctx, t.mediaType, t.tmdbId)}
              watchlist={watchlistProp(ctx, t.mediaType, t.tmdbId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Slim the movies page down to a wrapper**

Replace the whole body of `src/app/mood/[slug]/page.tsx` with:

```tsx
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getMoodBySlug } from "@/lib/moods";
import { MoodView } from "./MoodView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mood = getMoodBySlug(slug);
  return mood ? { title: `${mood.label}: movies to watch`, description: mood.blurb } : {};
}

export default async function MoodPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const mood = getMoodBySlug(slug);
  if (!mood) notFound();
  return <MoodView mood={mood} media="movie" />;
}
```

Note the metadata title now uses a colon, not the em dash it had before. That em dash was a standing-rule violation reaching browser tabs and search results.

- [ ] **Step 3: Verify no em dashes and typecheck**

```bash
grep -rn "—" src/app/mood/
```
Expected: no matches.

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/mood/
git commit -m "Extract shared MoodView and fix em dash in mood metadata title"
```

---

## Task 7: TV route

**Files:**
- Create: `src/app/mood/[slug]/tv/page.tsx`

- [ ] **Step 1: Write the route**

Create `src/app/mood/[slug]/tv/page.tsx`:

```tsx
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getMoodBySlug, hasTvTab, moodBlurb } from "@/lib/moods";
import { MoodView } from "../MoodView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mood = getMoodBySlug(slug);
  if (!mood || !hasTvTab(mood)) return {};
  return { title: `${mood.label}: TV shows to watch`, description: moodBlurb(mood, "tv") };
}

export default async function MoodTvPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const mood = getMoodBySlug(slug);
  // 404 rather than an empty tab: a mood with no curated TV list has no TV page.
  if (!mood || !hasTvTab(mood)) notFound();
  return <MoodView mood={mood} media="tv" />;
}
```

- [ ] **Step 2: Verify no em dashes**

Run: `grep -n "—" src/app/mood/[slug]/tv/page.tsx`
Expected: no matches.

- [ ] **Step 3: Full test suite and build**

```bash
npx vitest run
```
Expected: all tests pass.

```bash
npm run build
```
Expected: clean build. Allow up to 9 minutes, builds are slow on this machine.

- [ ] **Step 4: Commit**

```bash
git add src/app/mood/
git commit -m "Add mood TV tab route"
```

---

## Task 8: Verify against live data

Static checks cannot catch a wrong-but-valid TMDB id, for example an id that resolves to a different show than intended. Verify the rendered output.

- [ ] **Step 1: Start the dev server and spot-check three moods**

Check `/mood/dystopian-futures/tv`, `/mood/classic-hollywood/tv` and `/mood/festive-favourites`.

Expected:
- dystopian-futures TV shows The Handmaid's Tale, Black Mirror, The 100 in curated order, with tabs visible.
- classic-hollywood TV shows I Love Lucy first and uses the golden-age-of-television blurb, not the Hollywood one.
- festive-favourites shows no tabs at all, and `/mood/festive-favourites/tv` returns 404.

- [ ] **Step 2: Confirm every curated id resolved**

Any card rendering as "Untitled" means `titleBrief` failed or the id is wrong. There should be none. Note the id and re-verify it against TMDB before shipping.

- [ ] **Step 3: Push and watch the deployment**

```bash
git push
```

Then confirm the deployment reaches Ready, that `www.haystackk.com` and `haystackk.com` aliases actually moved to the new deployment, and that the live page serves the new content. Do not trust deployment metadata alone: an out-of-order deployment has previously reclaimed the production domain and silently reverted a fix.

- [ ] **Step 4: Verify live**

```bash
curl -s "https://www.haystackk.com/mood/dystopian-futures/tv" | grep -o "Handmaid" | head -1
```
Expected: a match.

---

## Self-review notes

- Every task lists exact files and complete code, no placeholders.
- Types are consistent across tasks: `MoodMedia` is defined once in Task 1 and imported by Tasks 3, 4, 5, 6 and 7.
- `getMoodTitles`'s new middle parameter is a breaking signature change; Task 4 Step 3 fixes the only caller in the same commit.
- Task 2's list count is 21: all 22 moods except festive-favourites, which stays movie-only because its 4 verified shows fall below the one-row visual floor. An earlier draft said 20, which double-counted festive-favourites against so-bad-its-good.
- `border-border` and `text-accent-text` were both confirmed against `src/app/globals.css` during planning, so Task 5 carries no unverified token assumption.
