# Episode share card design

**Date:** 2026-08-18
**Status:** Approved, ready for implementation planning

## Goal

Give a single TV episode its own shareable URL and its own link preview. Sharing an
episode today shares the whole show: the preview shows the show backdrop and the show
title, with nothing to say which episode was meant.

This is the first of two sequenced projects. The episode voting engine is specified
separately and depends on the URL introduced here.

## Findings that shape the design

All three come from reading the current code, not from assumption.

### Finding 1: episodes have no server-visible address

`SeasonsAccordion` gives every episode row an `id` of `s{season}e{episode}` and a
`CopyLinkButton` that copies `location.pathname` plus that hash. A fragment is never sent
to the server, so `generateMetadata` and the OG route cannot see which episode was linked.
No amount of work on the card fixes this while the episode is addressed by a hash.

This is the blocker, and it is why the route below exists.

### Finding 2: episodes have no table, and there is already a convention for that

Episodes are fetched from TMDB per show and never persisted. `list_items` addresses an
episode as `(titleId, seasonNumber, episodeNumber)` with a denormalised `episodeName`,
where `0/0` means the whole title. `episode_watches` uses the same triple. The episode
URL should decompose to exactly that triple so it lines up with what the database
already understands.

### Finding 3: the existing OG route works around a Satori bug

`/title/[mediaType]/[idSlug]/og` fetches the backdrop itself and inlines it as a base64
data URI, with a comment recording that Satori's own image fetch is flaky and produced
blank cards. The episode card must carry that technique over rather than passing a URL
to `ImageResponse`.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Episode address | Sub-route `/title/tv/{idSlug}/s1e1` | Only a real path reaches the server, which is what makes a per-episode card possible. |
| Card image | Show poster | Requested. Portrait, so the layout differs from the landscape title card. |
| Card year | Episode air year, falling back to show year | An episode card is about the episode. Show year is the fallback when TMDB has no air date. |
| Indexing | `noindex` plus robots.txt disallow | One page per episode is a very large crawlable surface. See Crawl containment. |
| Hash links | Keep working, unchanged | Existing `#s1e1` anchors stay valid. The sub-route is additive. |

## Architecture

### Route and parsing

New route: `src/app/title/[mediaType]/[idSlug]/[episode]/page.tsx`.

`[episode]` is a dynamic segment sitting alongside the existing static `og` segment. Next
resolves static segments before dynamic ones, so `/title/movie/123-x/og` continues to hit
the OG route rather than the episode page.

Parsing lives in a pure, unit-tested helper beside `parseIdSlug` in `src/lib/tmdb/detail.ts`:

```ts
parseEpisodeSlug("s1e1")   // { season: 1, episode: 1 }
parseEpisodeSlug("S12E07") // { season: 12, episode: 7 }
parseEpisodeSlug("og")     // null
parseEpisodeSlug("s0e1")   // null  (specials are not addressable)
```

The page 404s when: the media type is not `tv`, the id does not parse, the episode slug
does not parse, or TMDB has no such episode.

### Data access

The page needs one season, not the whole show.

The cached season fetch currently lives inside `/api/v1/tv/[id]/season/[n]/route.ts` as a
local `seasonEpisodes` helper. The page must not import from a route module, and must not
grow a second cache for the same data, so the first implementation step is to lift that
helper into a service, `src/services/tv-season.ts`, keeping its `cacheLife("days")` and
its `tv-season:{tvId}:{n}` tag. The API route and both new routes then share one cache
entry per season.

Consequence: an episode page costs one TMDB call for the first episode of a season viewed
and nothing for the rest, and the page and its OG card share that entry rather than
fetching twice.

It deliberately does not use `episodeIndex`, which fetches every season of the show.

### Page

Renders the episode still, show title linking back to the show, `Season N, Episode M`,
episode title, air date, runtime, overview, and guest cast if present. It reuses the
existing card and layout primitives rather than introducing new ones. A `ShareButton`
sits in the header.

The page carries `robots: { index: false, follow: true }` in its metadata, so crawlers
that arrive still walk back to the show page without indexing the episode.

### OG card

New route: `src/app/title/[mediaType]/[idSlug]/[episode]/og/route.tsx`, modelled on the
existing title OG route.

Layout at 1200x630: the show poster on the left at its natural portrait aspect, and a text
column on the right holding, in order:

1. Show title
2. `S2 - E5` as a meta line
3. Episode title
4. Year
5. Synopsis, clamped so it cannot overflow the card

The poster is fetched server side and inlined as base64, per Finding 3. Every failure
degrades rather than throws: a missing poster falls back to the branded card the title
route already produces, and a missing episode falls back to the show's own card.

Font sizing follows the existing route's approach of stepping the title size down as the
string gets longer.

### Share button

`ShareButton` currently shares `window.location.href`. It gains an optional `url` prop,
defaulting to current behaviour so existing call sites are untouched.

In `SeasonsAccordion`, the per-episode `CopyLinkButton` is replaced by a `ShareButton`
pointed at the canonical episode URL. That upgrades the row from "copy a link" to the
native share sheet, with clipboard as the fallback, which is what makes the new card
actually reach anyone.

### Crawl containment

A page per episode is potentially hundreds of thousands of URLs. Four days before this was
written, a crawler walked the title ids at roughly 218 req/s, so this is a live concern
rather than a theoretical one.

Containment:

- `noindex` on the episode page.
- `disallow: "/title/*/*/s*e*"` added to the catch-all rule in `robots.ts`, alongside the
  existing `/find` and `/rank` entries. Wildcards in the middle of a path are honoured by
  every major crawler, and the pattern cannot match a bare title page because it requires
  a fourth segment.
- No sitemap entries. The project has no sitemap today, so there is nothing to exclude.

Link unfurlers generally do not consult robots.txt, so previews still render. This is the
deliberate trade: the card works for humans sharing links, and the pages stay out of
search indexes and off crawler paths.

## Data flow

```
/title/tv/1396-breaking-bad/s1e1
  -> parseIdSlug        -> 1396
  -> parseEpisodeSlug   -> { season: 1, episode: 1 }
  -> cached season fetch (tv-season:1396:1)
  -> episode found? render : notFound()

<meta og:image> -> /title/tv/1396-breaking-bad/s1e1/og
  -> same parse + same cached season fetch
  -> poster fetched and inlined as base64
  -> ImageResponse
```

## Error handling

| Case | Behaviour |
| --- | --- |
| Media type is not `tv` | 404 |
| Unparseable id or episode slug | 404 |
| Season 0 (specials) | 404, matching the accordion which hides them |
| TMDB season fetch fails | Page 404s. The cached helper throws rather than caching an empty season. |
| Episode number not in season | 404 |
| Poster missing or fetch fails | Card renders on the branded fallback background |
| Overview missing | Card omits the synopsis block rather than leaving dead space |

## Testing

Unit tests, following the existing style in `src/lib/tmdb/detail.test.ts`:

- `parseEpisodeSlug`: valid lowercase and uppercase, multi-digit season and episode,
  zero-padded episode, season 0 rejected, non-matching strings rejected, and the `og`
  segment specifically rejected so the static route can never be shadowed.
- The pure part of the card text assembly: meta line, year selection including the
  fallback to show year, and synopsis clamping.

The OG route itself is not unit tested, matching how the existing title OG route is
handled. It is verified by loading a real episode URL and checking the rendered card.

## Out of scope

- The episode voting engine. Separate spec, built after this.
- Cross-show episode search. Explicitly deferred: it needs a persistent episode index
  with a cron to populate it, which is a standing cost with no demand evidence yet.
- Changing how `#s1e1` anchors behave. They keep working as they do today.

## Risks

| Risk | Mitigation |
| --- | --- |
| Crawlable surface grows sharply | `noindex` plus robots disallow, per Crawl containment. Revisit if invocation counts move. |
| Unfurlers that do honour robots.txt will not render the card | Accepted. The major ones do not. |
| Season fetch cache miss on a cold episode link | One TMDB call, then warm for days for the whole season. |
