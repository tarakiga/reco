# Mood TV tabs design

**Date:** 2026-07-27
**Status:** Approved, ready for implementation planning

## Goal

Every mood currently returns movies only. Add a TV tab to each mood so users can browse
shows in the same mood, while the home page keeps cycling movie moods exactly as it does
today.

## Feasibility findings

Both findings below come from live TMDB probes run on 2026-07-27, not from assumption.

### Finding 1: Discover queries cannot be translated to TV

TMDB's TV genre vocabulary is a different, smaller list than the movie one. These movie
genres have no TV equivalent at all: Romance (10749), Horror (27), Thriller (53), Action
(28), Adventure (12), Sci-Fi (878), Fantasy (14), History (36), War (10752), Music (10402).

TMDB silently ignores an unknown genre id rather than returning an error, so the failure is
invisible in the response. Running the four existing query-based moods against
`/discover/tv` as-is:

| Mood | Query | TV results |
| --- | --- | --- |
| date-night | `with_genres=10749` | 2 |
| spooky-season | `with_genres=27` | 0 |
| summer-blockbusters | `with_genres=28\|12\|878` | 0 |
| inspirational | `with_keywords=253695` | 1 |
| cosy-night-in | `with_genres=35\|10749\|10751` | 403, but returns Rick and Morty and Wednesday (wrong vibe) |
| family-movie-night | `with_genres=10751\|16` | 765, but top hits are Attack on Titan and Demon Slayer (mature anime) |

Additionally, `certification.lte` behaves differently on TV: it drops every show lacking US
certification data entirely, so the safety net that keeps mature titles out of the family and
cosy moods does not carry over.

**Consequence:** TV moods must be hand-curated id lists. There is no `queryTv` equivalent.
This is consistent with how the strongest existing moods already work: 13 of 22 are already
`manual`.

### Finding 2: curation is viable for 21 of 22 moods

Roughly 16 candidate shows were drafted per mood and verified against TMDB, correcting
false-positive search matches along the way (for example "The Fall" matched *The Fall Guy*,
"Warrior" matched *Xena: Warrior Princess*).

The reference bar used below is 12 or more shows at 100 or more votes. This is a sizing
heuristic for this feasibility check, not a shipping gate. Curated lists grow over time, so a
mood can launch its TV tab with fewer titles and gain more later. The practical floor is
visual: roughly 6 titles fill a grid row, so a list below that looks broken rather than
merely short.

**Comfortably viable (18):** cosy-night-in (15), edge-of-your-seat (16), need-a-laugh (16),
a-good-cry (14), mind-benders (16), b-movie-mashups (13), popcorn-action (16), grindhouse
(16), date-night (16), epic-adventures (15), family-movie-night (14), true-stories (16),
inspirational (12), teen-outsiders (16), dystopian-futures (16), spooky-season (16),
valentines-picks (15), summer-blockbusters (16).

**Viable with an adjustment (2):**

- **classic-hollywood:** 11 clear the bar, but the bar is wrong for this era. *The
  Honeymooners* (69 votes), *Leave It to Beaver* (88), *The Fugitive* (62) and *Rawhide* (49)
  are canonical golden-age television with low TMDB engagement. The 100-vote bar is a
  curation heuristic used during this feasibility check, not a runtime filter, so the fix is
  simply to accept lower-voted pre-1970 titles when curating this one list. That brings it
  comfortably above 16. This mood also needs a `blurbTv` override, since "Hollywood's golden
  age" does not describe *I Love Lucy*.
- **martial-arts-underdogs:** about 11 real hits, which is fine to ship. Reaching a larger
  list means leaning into anime (Baki, Kengan Ashura, MEGALOBOX and Fighting Spirit are
  already verified), which shifts the mood's character somewhat toward anime relative to its
  movie tab. Accepted deliberately.

**Ships short, grows later (1):** so-bad-its-good (8 hits). The TV equivalents such as
Manimal, Automan and Small Wonder are more obscure than the movie canon, but 8 clears the
visual floor and the list can grow.

**Stays movie-only for now (1):** festive-favourites (4 hits). Christmas is a movie format
and series-length Christmas TV barely exists, so this one falls below the visual floor. It
gets no TV tab until the list is curated up past roughly 6 titles, which the `manualTv`
mechanism supports with no code change.

## Architecture

### Data model

One optional field pair on the existing `Mood` interface in `src/lib/moods.ts`:

```ts
export interface Mood {
  // ...existing fields unchanged
  manual?: number[];    // hand-picked movie ids (unchanged)
  manualTv?: number[];  // hand-picked TV ids; presence is what enables the TV tab
  blurbTv?: string;     // optional blurb override, only where framing differs
}
```

Presence of `manualTv` is the single switch that enables the TV tab. Moods without it
(festive-favourites at launch) render exactly as they do today with no tabs shown, so there
are no dead ends and no greyed-out affordances. Adding a TV tab later is a data change only.

`blurbTv` is expected to be used by classic-hollywood only, possibly one or two others. The
default is to share one blurb across both tabs, because a mood means the same thing whether
it is expressed in films or shows.

### Service layer

`getMoodTitles(slug, mediaType, pages)` in `src/services/moods.ts` gains a `mediaType`
parameter, with `cacheTag(\`mood:${slug}:${mediaType}\`)` so the movie and TV caches are
independent and can be revalidated separately.

A `manualShow()` helper mirrors the existing `manualMovie()`: it calls
`tmdb.titleBrief("tv", id)`, reads `name` and `first_air_date` rather than `title` and
`release_date`, and builds `/title/tv/...` hrefs. The existing movie code path is untouched.

Order preservation and de-duplication behave exactly as they do for `manual` today.

### Routing

`/mood/[slug]` stays movies, so every existing link and any external inbound link keeps
working with no redirects. `/mood/[slug]/tv` is added as a new route segment.

Tabs are plain links between the two routes. This gives each tab its own indexable URL and
its own metadata title ("movies to watch" versus "TV shows to watch"), which doubles the SEO
surface. A query parameter such as `?type=tv` would collapse both into one weakly-indexed
URL for no caching benefit, since the mood page is already dynamic (`connection()`) and all
caching lives at the service layer.

### Home page

Untouched. `featuredMoods()` and the daily rotation algorithm keep cycling movie moods only.

### Moods index page

`/moods` cards continue to link to the movie tab. No tab affordance on the index, to keep the
grid scannable.

## Incidental fix

`src/app/mood/[slug]/page.tsx:14` currently sets the metadata title to
`` `${mood.label} — movies to watch` ``, which contains an em dash in a user-facing string
(browser tab and search results). This violates the project's standing no-em-dash rule. It
predates this work but sits on the exact line that must change to support per-tab metadata,
so it is fixed here. Replacement wording: `` `${mood.label}: movies to watch` `` and
`` `${mood.label}: TV shows to watch` ``.

## Testing

- `src/lib/moods.test.ts` stays valid: the rotation tests are agnostic to mood count and to
  the new optional fields. Add a case asserting that a mood without `manualTv` is treated as
  movie-only.
- Add service tests covering `manualShow()` ordering, de-duplication, and `tv` href shape.
- Verify every curated TV id against TMDB before it lands, the same standing practice used
  for every curated movie list. Ids are verified by direct API lookup, never guessed.
- Grep every touched file for em dashes before committing.

## Out of scope

- Curating a TV list for festive-favourites.
- Any change to home-page mood rotation.
- TV moods driven by Discover queries, which Finding 1 rules out.
