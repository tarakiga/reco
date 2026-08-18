# Episode Share Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a TV episode its own URL at `/title/tv/{idSlug}/s1e1` and its own link preview card showing the show poster alongside the show title, season, episode, episode title, year and synopsis.

**Architecture:** A dynamic `[episode]` route segment sits beside the existing static `og` segment under the title route. A pure `parseEpisodeSlug` turns `s1e1` into a season/episode pair, and a shared `seasonEpisodes` service (cached per show and season) feeds both the page and its OG route, so an episode costs at most one TMDB call per season. Card text is assembled by a pure helper so the wording, the year rule and synopsis clamping are unit tested without rendering an image.

**Tech Stack:** Next.js 16 App Router with `cacheComponents`, `next/og` (Satori) plus `sharp` for JPEG re-encoding, Drizzle, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-episode-share-card-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/services/tv-season.ts` (create) | Cached per-season episode fetch, shared by the API route, page and OG route |
| `src/services/tv-season.test.ts` (create) | Tests for the above |
| `src/app/api/v1/tv/[id]/season/[n]/route.ts` (modify) | Stops owning the cache, calls the service |
| `src/lib/tmdb/detail.ts` (modify) | Adds `parseEpisodeSlug` beside `parseIdSlug` |
| `src/lib/tmdb/detail.test.ts` (modify) | Tests for `parseEpisodeSlug` |
| `src/lib/tmdb/episode-card.ts` (create) | Pure card text: meta line, year, clamped synopsis |
| `src/lib/tmdb/episode-card.test.ts` (create) | Tests for the above |
| `src/app/title/[mediaType]/[idSlug]/[episode]/page.tsx` (create) | The episode page and its metadata |
| `src/app/title/[mediaType]/[idSlug]/[episode]/og/route.tsx` (create) | The episode OG image |
| `src/components/catalog/SeasonsAccordion.tsx` (modify) | Episode row shares the canonical URL |
| `src/app/robots.ts` (modify) | Disallow the episode sub-route |
| `src/app/robots.test.ts` (create) | Asserts the disallow is present |

---

### Task 1: Share the cached season fetch

The cache currently lives inside the API route module. The page and OG route cannot import from a route module, and must not grow a second cache for the same data, so it moves to a service first.

**Files:**
- Create: `src/services/tv-season.ts`
- Create: `src/services/tv-season.test.ts`
- Modify: `src/app/api/v1/tv/[id]/season/[n]/route.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/tv-season.test.ts`:

```ts
import { vi, type Mock } from "vitest";

vi.mock("@/lib/tmdb/client", () => ({
  tmdb: { season: vi.fn() },
}));

import { tmdb } from "@/lib/tmdb/client";
import { seasonEpisodes, oneEpisode } from "./tv-season";

const SEASON = {
  id: 1,
  season_number: 1,
  episodes: [
    {
      id: 11,
      episode_number: 1,
      name: "Pilot",
      overview: "First one.",
      air_date: "2008-01-20",
      runtime: 58,
      vote_average: 8.2,
      vote_count: 100,
      still_path: "/a.jpg",
    },
    {
      id: 12,
      episode_number: 2,
      name: "Cat's in the Bag...",
      overview: "Second one.",
      air_date: "2008-01-27",
      runtime: 48,
      vote_average: 8.1,
      vote_count: 90,
      still_path: null,
    },
  ],
};

test("maps a season into episode view models", async () => {
  (tmdb.season as Mock).mockResolvedValue(SEASON);
  const eps = await seasonEpisodes(1396, 1);
  expect(eps).toHaveLength(2);
  expect(eps[0]).toMatchObject({ episodeNumber: 1, name: "Pilot", runtime: 58, airDate: "2008-01-20" });
});

test("oneEpisode finds an episode by number", async () => {
  (tmdb.season as Mock).mockResolvedValue(SEASON);
  expect((await oneEpisode(1396, 1, 2))?.name).toBe("Cat's in the Bag...");
});

test("oneEpisode returns null when the number is not in the season", async () => {
  (tmdb.season as Mock).mockResolvedValue(SEASON);
  expect(await oneEpisode(1396, 1, 99)).toBeNull();
});

test("a failed season fetch propagates so an empty season is never cached", async () => {
  (tmdb.season as Mock).mockRejectedValue(new Error("TMDB 502"));
  await expect(seasonEpisodes(1396, 2)).rejects.toThrow("TMDB 502");
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/services/tv-season.test.ts`
Expected: FAIL, cannot resolve `./tv-season`.

- [ ] **Step 3: Write the service**

Create `src/services/tv-season.ts`:

```ts
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { toEpisodes, type EpisodeVM } from "@/lib/tmdb/episodes";

/**
 * One season's episodes, cached per show and season. Shared by the season API
 * route, the episode page and the episode OG card, so all three read one entry
 * rather than each paying for its own TMDB call.
 *
 * A failed fetch throws rather than returning empty, so a transient TMDB error
 * is never cached in place of a real season.
 */
export async function seasonEpisodes(tvId: number, seasonNumber: number): Promise<EpisodeVM[]> {
  "use cache";
  cacheLife("days");
  cacheTag(`tv-season:${tvId}:${seasonNumber}`);
  return toEpisodes(await tmdb.season(tvId, seasonNumber));
}

/** A single episode, or null when the season has no such episode number. */
export async function oneEpisode(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<EpisodeVM | null> {
  const episodes = await seasonEpisodes(tvId, seasonNumber);
  return episodes.find((e) => e.episodeNumber === episodeNumber) ?? null;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/services/tv-season.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Point the API route at the service**

Replace the body of `src/app/api/v1/tv/[id]/season/[n]/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { seasonEpisodes } from "@/services/tv-season";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; n: string }> },
) {
  const { id, n } = await params;
  const tvId = Number(id);
  const seasonNumber = Number(n);
  if (!Number.isInteger(tvId) || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
    return NextResponse.json({ error: "Invalid id or season" }, { status: 400 });
  }
  try {
    return NextResponse.json({ episodes: await seasonEpisodes(tvId, seasonNumber) });
  } catch {
    return NextResponse.json({ error: "Season unavailable" }, { status: 502 });
  }
}
```

- [ ] **Step 6: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx next build`
Expected: `Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add src/services/tv-season.ts src/services/tv-season.test.ts "src/app/api/v1/tv/[id]/season/[n]/route.ts"
git commit -m "Lift the cached season fetch into a service"
```

---

### Task 2: Parse the episode slug

**Files:**
- Modify: `src/lib/tmdb/detail.ts` (add beside `parseIdSlug` at line 10)
- Modify: `src/lib/tmdb/detail.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/tmdb/detail.test.ts`. Add `parseEpisodeSlug` to the existing import list from `./detail` at the top of the file, then append:

```ts
test("parseEpisodeSlug reads season and episode numbers", () => {
  expect(parseEpisodeSlug("s1e1")).toEqual({ season: 1, episode: 1 });
  expect(parseEpisodeSlug("S12E07")).toEqual({ season: 12, episode: 7 });
  expect(parseEpisodeSlug("s3e120")).toEqual({ season: 3, episode: 120 });
});

test("parseEpisodeSlug rejects specials and zero episodes", () => {
  expect(parseEpisodeSlug("s0e1")).toBeNull();
  expect(parseEpisodeSlug("s1e0")).toBeNull();
});

test("parseEpisodeSlug rejects anything that is not an episode segment", () => {
  expect(parseEpisodeSlug("og")).toBeNull();
  expect(parseEpisodeSlug("")).toBeNull();
  expect(parseEpisodeSlug("s1e1x")).toBeNull();
  expect(parseEpisodeSlug("season1")).toBeNull();
  expect(parseEpisodeSlug("1396-breaking-bad")).toBeNull();
});
```

The `og` case matters: it is the sibling static route, and this parser must never claim it.

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/tmdb/detail.test.ts`
Expected: FAIL, `parseEpisodeSlug is not a function`.

- [ ] **Step 3: Implement it**

In `src/lib/tmdb/detail.ts`, directly below `parseIdSlug`:

```ts
export interface EpisodeRef {
  season: number;
  episode: number;
}

/**
 * Parse an episode path segment ("s1e1") into its season and episode numbers.
 * Null for anything else, which is what keeps the sibling static "og" segment
 * safe. Season 0 is rejected because specials are hidden everywhere else in the
 * app, so they have no page to link to.
 */
export function parseEpisodeSlug(slug: string): EpisodeRef | null {
  const m = slug.match(/^s(\d{1,3})e(\d{1,4})$/i);
  if (!m) return null;
  const season = Number(m[1]);
  const episode = Number(m[2]);
  if (season < 1 || episode < 1) return null;
  return { season, episode };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/lib/tmdb/detail.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tmdb/detail.ts src/lib/tmdb/detail.test.ts
git commit -m "Parse an s1e1 episode path segment"
```

---

### Task 3: Assemble the card text

**Files:**
- Create: `src/lib/tmdb/episode-card.ts`
- Create: `src/lib/tmdb/episode-card.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/tmdb/episode-card.test.ts`:

```ts
import { test, expect } from "vitest";
import { episodeCardFields } from "./episode-card";

const BASE = {
  showYear: 2008,
  season: 1,
  episode: 1,
  airDate: "2008-01-20",
  overview: "A chemistry teacher gets a diagnosis.",
};

test("builds the season and episode meta line", () => {
  expect(episodeCardFields(BASE).metaLine).toBe("S1 - E1");
  expect(episodeCardFields({ ...BASE, season: 12, episode: 7 }).metaLine).toBe("S12 - E7");
});

test("prefers the episode air year over the show year", () => {
  expect(episodeCardFields({ ...BASE, airDate: "2011-07-17" }).year).toBe(2011);
});

test("falls back to the show year when there is no air date", () => {
  expect(episodeCardFields({ ...BASE, airDate: null }).year).toBe(2008);
});

test("falls back to the show year when the air date is malformed", () => {
  expect(episodeCardFields({ ...BASE, airDate: "abcd-01-01" }).year).toBe(2008);
});

test("returns a null year when neither is known", () => {
  expect(episodeCardFields({ ...BASE, airDate: null, showYear: null }).year).toBeNull();
});

test("passes a short synopsis through untouched", () => {
  expect(episodeCardFields(BASE).synopsis).toBe("A chemistry teacher gets a diagnosis.");
});

test("returns null rather than an empty synopsis", () => {
  expect(episodeCardFields({ ...BASE, overview: "   " }).synopsis).toBeNull();
});

test("clamps a long synopsis on a word boundary", () => {
  const long = `${"word ".repeat(80)}end`;
  const out = episodeCardFields({ ...BASE, overview: long }).synopsis!;
  expect(out.length).toBeLessThanOrEqual(244);
  expect(out.endsWith("...")).toBe(true);
  expect(out).not.toContain("wor...");
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/tmdb/episode-card.test.ts`
Expected: FAIL, cannot resolve `./episode-card`.

- [ ] **Step 3: Implement it**

Create `src/lib/tmdb/episode-card.ts`:

```ts
import { yearFromDate } from "@/lib/slug";

// Deliberately only the fields the card text actually derives from. The show
// title and episode name are rendered directly by the callers, so they are not
// arguments here.
export interface EpisodeCardInput {
  showYear: number | null;
  season: number;
  episode: number;
  airDate: string | null;
  overview: string;
}

export interface EpisodeCardFields {
  metaLine: string;
  year: number | null;
  synopsis: string | null;
}

const SYNOPSIS_MAX = 240;

/**
 * The text of an episode share card. Pure, so the wording, the year rule and
 * the clamping are testable without rendering an image.
 */
export function episodeCardFields(input: EpisodeCardInput): EpisodeCardFields {
  return {
    metaLine: `S${input.season} - E${input.episode}`,
    // The card is about the episode, so its air year wins. The show year is the
    // fallback when TMDB has no air date for it.
    year: yearFromDate(input.airDate) ?? input.showYear,
    synopsis: clamp(input.overview.trim()),
  };
}

function clamp(text: string): string | null {
  if (!text) return null;
  if (text.length <= SYNOPSIS_MAX) return text;
  const cut = text.slice(0, SYNOPSIS_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  const body = lastSpace > SYNOPSIS_MAX * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}...`;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/lib/tmdb/episode-card.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tmdb/episode-card.ts src/lib/tmdb/episode-card.test.ts
git commit -m "Assemble episode share card text"
```

---

### Task 4: The episode page

**Files:**
- Create: `src/app/title/[mediaType]/[idSlug]/[episode]/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/title/[mediaType]/[idSlug]/[episode]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrCreateTitle } from "@/services/catalog";
import { oneEpisode } from "@/services/tv-season";
import { parseIdSlug, parseEpisodeSlug } from "@/lib/tmdb/detail";
import { episodeCardFields } from "@/lib/tmdb/episode-card";
import { ShareButton } from "@/components/catalog/ShareButton";

interface Params {
  mediaType: string;
  idSlug: string;
  episode: string;
}

/** Show row, episode and parsed reference, or null when any part is unusable. */
async function load(params: Params) {
  if (params.mediaType !== "tv") return null;
  const id = parseIdSlug(params.idSlug);
  const ref = parseEpisodeSlug(params.episode);
  if (!id || !ref) return null;
  try {
    const show = await getOrCreateTitle("tv", id, false);
    const episode = await oneEpisode(id, ref.season, ref.episode);
    return episode ? { show, episode, ref } : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const p = await params;
  const data = await load(p);
  if (!data) return {};
  const { show, episode, ref } = data;
  const fields = episodeCardFields({
    showYear: show.releaseYear,
    season: ref.season,
    episode: ref.episode,
    airDate: episode.airDate,
    overview: episode.overview,
  });
  const title = `${show.title}: ${fields.metaLine} ${episode.name}`;
  const description = fields.synopsis ?? undefined;
  const ogImage = {
    url: `/title/tv/${p.idSlug}/${p.episode}/og`,
    width: 1200,
    height: 630,
    alt: title,
    type: "image/jpeg",
  };
  return {
    title,
    description,
    // One page per episode is a very large crawlable surface, so it stays out of
    // indexes. follow:true still lets a crawler walk back to the show page.
    robots: { index: false, follow: true },
    openGraph: { title, description, images: [ogImage], type: "video.episode" },
    twitter: { card: "summary_large_image", images: [ogImage.url] },
  };
}

export default async function EpisodePage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const data = await load(p);
  if (!data) notFound();
  const { show, episode, ref } = data;
  const fields = episodeCardFields({
    showYear: show.releaseYear,
    season: ref.season,
    episode: ref.episode,
    airDate: episode.airDate,
    overview: episode.overview,
  });
  const showHref = `/title/tv/${show.tmdbId}-${show.slug}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href={showHref} className="text-sm font-medium text-accent-text hover:underline">
        {show.title}
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-text-muted">
            Season {ref.season}, Episode {ref.episode}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-text sm:text-3xl">{episode.name}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {[fields.year ? String(fields.year) : null, episode.runtime ? `${episode.runtime} min` : null]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
        </div>
        <ShareButton title={`${show.title}: ${episode.name}`} />
      </div>

      {episode.stillUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={episode.stillUrl}
          alt=""
          className="mt-6 w-full rounded-lg border border-border object-cover"
        />
      ) : null}

      {episode.overview ? (
        <p className="mt-6 text-text-muted">{episode.overview}</p>
      ) : null}

      <p className="mt-8">
        <Link href={`${showHref}#s${ref.season}e${ref.episode}`} className="text-sm text-accent-text hover:underline">
          See this episode in the full season list
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx next build`
Expected: `Compiled successfully`, and the route list includes `/title/[mediaType]/[idSlug]/[episode]`.

- [ ] **Step 3: Confirm the static og route still wins**

Run: `npx next build 2>&1 | grep "idSlug"`
Expected: both `/title/[mediaType]/[idSlug]/og` and `/title/[mediaType]/[idSlug]/[episode]` appear. Static wins at request time, so `/og` is unaffected.

- [ ] **Step 4: Commit**

```bash
git add "src/app/title/[mediaType]/[idSlug]/[episode]/page.tsx"
git commit -m "Add an episode page with its own metadata"
```

---

### Task 5: The episode OG card

Modelled on `src/app/title/[mediaType]/[idSlug]/og/route.tsx`. Two details are carried over deliberately: the image is fetched and inlined as base64 because Satori's own fetch is flaky and produced blank cards, and the PNG is re-encoded to JPEG because WhatsApp skips large images.

**Files:**
- Create: `src/app/title/[mediaType]/[idSlug]/[episode]/og/route.tsx`

- [ ] **Step 1: Write the route**

Create `src/app/title/[mediaType]/[idSlug]/[episode]/og/route.tsx`:

```tsx
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getOrCreateTitle } from "@/services/catalog";
import { oneEpisode } from "@/services/tv-season";
import { parseIdSlug, parseEpisodeSlug } from "@/lib/tmdb/detail";
import { episodeCardFields } from "@/lib/tmdb/episode-card";
import { posterUrl } from "@/lib/tmdb/images";
import { BRAND_NAME } from "@/lib/brand";

const SIZE = { width: 1200, height: 630 };
const ACCENT = "#e63946";
const SURFACE = "#0b0d12";
const TEXT = "#f2f4f8";
const MUTED = "#cbd2dd";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mediaType: string; idSlug: string; episode: string }> },
) {
  const { mediaType, idSlug, episode: episodeSlug } = await params;
  const id = parseIdSlug(idSlug);
  const ref = parseEpisodeSlug(episodeSlug);

  let showTitle = BRAND_NAME;
  let episodeName = "";
  let metaLine = "";
  let yearLine = "";
  let synopsis: string | null = null;
  let posterSrc: string | null = null;

  if (id && ref && mediaType === "tv") {
    try {
      const show = await getOrCreateTitle("tv", id, false);
      const episode = await oneEpisode(id, ref.season, ref.episode);
      showTitle = show.title;
      posterSrc = posterUrl(show.posterPath);
      if (episode) {
        const fields = episodeCardFields({
          showYear: show.releaseYear,
          season: ref.season,
          episode: ref.episode,
          airDate: episode.airDate,
          overview: episode.overview,
        });
        episodeName = episode.name;
        metaLine = fields.metaLine;
        yearLine = fields.year ? String(fields.year) : "";
        synopsis = fields.synopsis;
      }
    } catch {
      /* fall back to the branded card */
    }
  }

  // Satori's own image fetch is flaky, which is why some cards came out blank.
  // Fetch it ourselves and inline it.
  let poster: string | null = null;
  if (posterSrc) {
    try {
      const res = await fetch(posterSrc);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        poster = `data:${res.headers.get("content-type") ?? "image/jpeg"};base64,${buf.toString("base64")}`;
      }
    } catch {
      /* no poster, the text column still renders */
    }
  }

  const nameSize = episodeName.length > 40 ? 46 : episodeName.length > 24 ? 58 : 70;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: SURFACE,
          fontFamily: "sans-serif",
          padding: 56,
        }}
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            width={346}
            height={518}
            style={{ width: 346, height: 518, borderRadius: 12, objectFit: "cover" }}
          />
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            marginLeft: poster ? 48 : 0,
            height: 518,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: MUTED }}>{showTitle}</div>
            {metaLine ? (
              <div style={{ display: "flex", marginTop: 10, fontSize: 28, fontWeight: 700, color: ACCENT }}>
                {metaLine}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                marginTop: 16,
                fontSize: nameSize,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -1,
                color: TEXT,
              }}
            >
              {episodeName}
            </div>
            {yearLine ? (
              <div style={{ display: "flex", marginTop: 12, fontSize: 26, color: MUTED }}>{yearLine}</div>
            ) : null}
            {synopsis ? (
              <div style={{ display: "flex", marginTop: 20, fontSize: 24, lineHeight: 1.35, color: MUTED }}>
                {synopsis}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: TEXT }}>
            {BRAND_NAME}
            <span style={{ color: ACCENT, display: "flex" }}>.</span>
          </div>
        </div>
      </div>
    ),
    { ...SIZE },
  );

  // ImageResponse is PNG-only and a poster PNG is large enough that WhatsApp may
  // skip it. Re-encode as JPEG so the preview shows reliably.
  const png = Buffer.from(await image.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
```

- [ ] **Step 2: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx next build`
Expected: `Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/title/[mediaType]/[idSlug]/[episode]/og/route.tsx"
git commit -m "Render an episode share card with the show poster"
```

---

### Task 6: Share the canonical episode URL from the accordion

`ShareButton` is deliberately not modified. On the episode page its default of
`window.location.href` is already the canonical URL. Only the season list needs to share
a URL other than the current page, and the file already contains a local `CopyLinkButton`
that builds a URL from `window.location.pathname` at click time. A sibling local component
follows that existing pattern, needs no prop threading, and avoids an SSR hydration
mismatch from touching `window` during render.

**Files:**
- Modify: `src/components/catalog/SeasonsAccordion.tsx` (add a component beside `CopyLinkButton` at line 58, swap the episode row button at line 169)

- [ ] **Step 1: Add the local share button**

In `src/components/catalog/SeasonsAccordion.tsx`, directly after the `CopyLinkButton`
component definition, add:

```tsx
/** Share one episode by its own URL. The accordion only renders on a show page,
 *  so the current pathname plus the episode segment is that episode's canonical
 *  address. Built at click time because `window` does not exist during SSR. */
function ShareEpisodeButton({ segment, title }: { segment: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Share ${title}`}
      title={`Share ${title}`}
      onClick={(e) => {
        e.stopPropagation();
        const url = `${window.location.origin}${window.location.pathname}/${segment}`;
        if (typeof navigator.share === "function") {
          navigator.share({ title, text: title, url }).catch(() => {});
          return;
        }
        navigator.clipboard
          ?.writeText(url)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          })
          .catch(() => {});
      }}
      className="flex size-7 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-overlay hover:text-accent-text"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
        </svg>
      )}
    </button>
  );
}
```

`useState` is already imported at the top of this file for `CopyLinkButton`.

- [ ] **Step 2: Swap the episode row button**

At line 169 the episode row currently renders:

```tsx
                <CopyLinkButton hash={`s${seasonNumber}e${ep.episodeNumber}`} label="Copy link to this episode" />
```

Replace exactly that line with:

```tsx
                <ShareEpisodeButton segment={`s${seasonNumber}e${ep.episodeNumber}`} title={ep.name} />
```

Both `seasonNumber` and `ep` are already in scope in this component, so nothing needs
threading. Leave `CopyLinkButton` defined and in place: the season header still uses it
at line 316.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint src/components/catalog/SeasonsAccordion.tsx`
Expected: no output.

Run: `npx next build`
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/components/catalog/SeasonsAccordion.tsx
git commit -m "Share the canonical episode URL from the season list"
```

---

### Task 7: Keep episode pages out of crawler paths

**Files:**
- Modify: `src/app/robots.ts`
- Create: `src/app/robots.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/robots.test.ts`:

```ts
import { test, expect } from "vitest";
import robots from "./robots";

test("keeps episode pages out of crawler paths", () => {
  const rule = robots().rules;
  const catchAll = (Array.isArray(rule) ? rule : [rule]).find((r) => r.userAgent === "*");
  const disallow = catchAll?.disallow;
  expect(Array.isArray(disallow) ? disallow : [disallow]).toContain("/title/*/*/s*e*");
});

test("still disallows the search result pages", () => {
  const rule = robots().rules;
  const catchAll = (Array.isArray(rule) ? rule : [rule]).find((r) => r.userAgent === "*");
  const disallow = (Array.isArray(catchAll?.disallow) ? catchAll.disallow : []) as string[];
  expect(disallow).toContain("/find");
  expect(disallow).toContain("/rank");
});
```

- [ ] **Step 2: Run it to confirm the first test fails**

Run: `npx vitest run src/app/robots.test.ts`
Expected: FAIL on the episode expectation, PASS on the `/find` and `/rank` one.

- [ ] **Step 3: Add the disallow**

In `src/app/robots.ts`, extend the catch-all rule's `disallow` array and its comment:

```ts
      // /find and /rank are excluded because they are result pages, not content:
      // every distinct query is a new URL, so crawling them generates unbounded
      // paths (12k distinct in six hours at last measure) and each one runs a
      // vector search. Search results are conventionally kept out of the index.
      // Episode pages are excluded for the same reason of volume: one page per
      // episode is a very large surface, and they exist to be shared, not found.
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/account", "/admin", "/api", "/find", "/rank", "/title/*/*/s*e*"],
        crawlDelay: 10,
      },
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/app/robots.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/robots.ts src/app/robots.test.ts
git commit -m "Keep episode pages out of crawler paths"
```

---

### Task 8: Verify the whole feature

**Files:** none changed.

- [ ] **Step 1: Full check**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint src/services/tv-season.ts src/lib/tmdb/episode-card.ts "src/app/title/[mediaType]/[idSlug]/[episode]/page.tsx" "src/app/title/[mediaType]/[idSlug]/[episode]/og/route.tsx" src/components/catalog/SeasonsAccordion.tsx src/app/robots.ts`
Expected: no output.

Run: `npx vitest run src/services/tv-season.test.ts src/lib/tmdb/detail.test.ts src/lib/tmdb/episode-card.test.ts src/app/robots.test.ts`
Expected: PASS.

Run: `npx next build`
Expected: `Compiled successfully`.

- [ ] **Step 2: Check the live page after deploy**

Once deployed, load `/title/tv/1396-breaking-bad/s1e1` and confirm: the page renders the episode, the title reads `Breaking Bad: S1 - E1 Pilot`, and viewing source shows `<meta name="robots" content="noindex">`.

- [ ] **Step 3: Check the card**

Load `/title/tv/1396-breaking-bad/s1e1/og` directly. Expected: a 1200x630 JPEG with the Breaking Bad poster on the left, and on the right the show title, `S1 - E1`, `Pilot`, `2008`, and the synopsis.

Then confirm `/title/tv/1396-breaking-bad/og` still returns the original backdrop card, proving the static segment still wins over the new dynamic one.

- [ ] **Step 4: Note the known unrelated failure**

`src/services/site-config.test.ts` fails for a pre-existing reason: it expects a two-item nav fallback while the defaults have grown to six. It is unrelated to this work. Do not fix it as part of this plan.

---

## Notes for the implementer

- **Never commit `producthunt-launch-copy.md`.** It is untracked in the repo root and must stay that way. Always use targeted `git add` with explicit paths, never `git add -A` or `git add .`.
- **No em dashes** in any user-facing string or comment.
- **No `Co-Authored-By` trailer** on commits.
- Paths with brackets need quoting in shell commands, as shown throughout.
