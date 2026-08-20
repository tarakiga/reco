# TV liveness design

**Date:** 2026-08-20
**Status:** Approved, ready for implementation planning

## Goal

A TV show's detail page should answer the two questions every returning visitor has
within one glance: is this show still alive, and where am I in it? Today it answers
neither. Production status renders on browse cards but not here, `next_episode_to_air`
is fetched and thrown away, and a viewer's episode watches surface only as checkmarks
buried inside the season accordion.

This is spec 1 of the two chosen detail-page directions. Spec 2 (smarter
personalisation: explainable match, badges on rails, embeddings-blended
recommendations) is a separate later spec.

## Findings that shape the design

### Finding 1: the data is already fetched and cached, then discarded

`tmdb.tvAiring(id)` returns `status`, `next_episode_to_air` and `last_air_date` in one
call. `src/services/tv-status.ts` already makes that call, cached daily per show and
tagged `tv-status:{tvId}`, and keeps only the status string. The banner needs no new
TMDB volume, only a wider return type on the same cached call.

### Finding 2: the detail page is the one place the status badge does not render

`statusBadge` in `src/lib/tv-status.ts` ("Ended", "Cancelled") renders on browse and
search cards via `tvStatusBadges`, but not on the show's own page, which is where the
question is actually asked.

### Finding 3: next-unwatched needs no episode fetch

`title.metadata` already carries `seasons[].episode_count` per season, and
`listEpisodeWatches(userId, title)` returns the watched set from the local database.
The first (season, episode) pair not in the watched set is computable from those two
alone. The season accordion already supports `#s2e3` deep links that scroll to and
flash the target row, so the progress line links into existing behaviour.

### Finding 4: the EPG is GB-only

Per `handoff.md`, the broadcast guide covers GB only. The banner therefore leads with
TMDB's global `next_episode_to_air` and treats broadcast-channel detail as an optional
enhancement that renders only when the per-show EPG helper (cached hourly, tagged
`epg-show:{tvId}`) has a broadcast inside the next 7 days. Non-GB visitors never see
an empty slot.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Data source | Widen the existing cached call | One cache entry per show per day serves badge and banner both |
| Audience for the banner | Everyone, including anonymous | It is catalog fact, not personalisation, and crawler traffic must stay cheap |
| Audience for progress | Signed-in with at least one watch | Renders nothing otherwise; no empty-state noise |
| Date handling | Request-time `todayYmd` passed as a prop | The clock-in-render purity lesson already applied to this page in `e92db2b` |
| Failure behaviour | Every failure renders nothing | A missing banner is invisible; a broken one is worse than none |

## Architecture

### Service: widen `tv-status.ts`

```ts
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

export async function tvAiringInfo(tvId: number): Promise<TvAiringInfo>
```

Carries the existing `"use cache"`, `cacheLife("days")` and `cacheTag("tv-status:{tvId}")`
from `tvStatus`, whose body becomes `(await tvAiringInfo(tvId)).status` so the badge
and the banner share one entry. Errors return the all-null shape rather than throwing,
matching the current `tvStatus` behaviour: liveness is decoration, never a page break.

### Pure helper: `airingLabel`

A pure function in `src/lib/tv-status.ts` beside `statusBadge`:

```ts
airingLabel(info: TvAiringInfo, todayYmd: string): AiringLabel | null
```

Returns the display decision: kind (`next-episode`, `returning`, `ended`, `cancelled`,
`in-production`) plus formatted text. Date phrasing: "Today", "Tomorrow", the weekday
name inside 7 days, otherwise a short date. Malformed or past `airDate` degrades to the
`returning` case. Pure so every boundary is unit-testable without a component render.

### Component: `AiringBanner`

Server component in `src/components/catalog/`, rendered under the hero meta row for TV
only, Suspense-wrapped so it streams. Renders the `airingLabel` outcome; for the
ended/cancelled kinds it reuses the exact `statusBadge` visual treatment. When the
per-show EPG helper returns a GB broadcast within 7 days, a second line names the
channel. Null label renders nothing.

### Component: `WatchProgress`

Server component at the top of the Episodes section, above `EpisodeFinder`. Signed-in
only. One `listEpisodeWatches` query plus `seasonSummaries(meta)`, then a pure
`nextUnwatched(watched: Set<string>, seasons: { seasonNumber, episodeCount }[])`
helper (also unit-tested) walks seasons in order for the first missing episode.
Specials (season 0) are excluded, matching the accordion. Renders "14 of 62 episodes"
with a slim progress bar and "Next up: S2 E3" linking to `#s2e3`. Fully watched
renders "All caught up". Zero watches renders nothing.

The total counts all episodes TMDB lists, including a currently-airing season's
not-yet-aired remainder. Accepted: the alternative needs per-season air dates and a
fetch this design refuses to add, and being 2 episodes "behind" a season in progress
reads correctly anyway.

## Cost profile

- `AiringBanner`: zero additional external calls. The EPG line reads an existing
  hourly-cached helper.
- `WatchProgress`: one indexed local DB read, only on signed-in TV views.
- Anonymous and crawler traffic: no new work at all.

## Error handling

| Case | Behaviour |
| --- | --- |
| `tvAiring` fails upstream | All-null info, banner renders nothing |
| Status is something unmapped ("Pilot", "Planned") | `in-production` kind when unreleased, else nothing |
| `airDate` malformed or in the past | Falls back to the `returning` case |
| EPG empty or errored | No channel line, banner otherwise unaffected |
| Anonymous viewer | No progress query runs at all |
| Metadata missing `seasons` | Progress renders nothing |

## Testing

Unit tests, existing style:

- `airingLabel`: today/tomorrow boundary, 7-day weekday window edge, far date, past
  date, null date with returning status, ended, cancelled, unmapped status.
- `nextUnwatched`: empty set, mid-season gap, cross-season boundary, fully watched,
  specials excluded, seasons out of order.
- `tvAiringInfo`: mocked client test proving badge and banner read one shared call,
  and the error path returns the null shape.

Components are exercised through the page as elsewhere in the repo; no component
snapshot tests.

## Out of scope

- Spec 2: explainable match, badges on rails, embeddings-blended More Like This.
- Movie-page changes; movies already carry release/VOD estimates in the facts panel.
- EPG coverage beyond GB.
- Notifications; `NotifyButton` already exists and is untouched.
