# Episode voting design

**Date:** 2026-08-19
**Status:** Draft, needs review before implementation planning

## Goal

Let a "Vote to Watch" poll ballot a specific TV episode, not just a whole movie or show.
A single poll can mix them freely: two episodes from different shows and a film can sit on
the same ballot.

This is the second of the two projects split out on 2026-08-18. The first, episode share
cards, shipped and gave episodes their own URL, which this design links winners to.

## Findings that shape the design

All four come from reading the current code.

### Finding 1: the engine is keyed on a title uuid at every layer

`poll_votes.title_id` is a foreign key to `titles`. `polls.round2_title_ids` is a
`uuid[]`. `polls.winner_title_id` is a uuid. `PollOption.titleId` is a uuid, and
`loadTitles` resolves votes by selecting from `titles`.

A uuid cannot express "season 1, episode 6 of this show", so the storage has to change.
It is the only part of the engine that does.

### Finding 2: there is already a convention for addressing an episode

`list_items` addresses one as `(titleId, seasonNumber, episodeNumber)` with a
denormalised `episodeName`, where `0/0` means the whole title. Its schema comment
explains why 0 rather than NULL: NULLs compare distinct, which would let the same show be
added twice. `episode_watches` uses the same triple.

This design follows that convention rather than inventing a second one.

### Finding 3: the two-step picker already exists

This is the finding that shrinks the work most.

`ListEditor` already implements exactly the flow this design needs, and even carries the
hint text "For TV show episodes, first search for the show, then pick the episode." It
searches `/api/v1/search`, shows an "Episodes" button on TV results, and opens
`ListEpisodePicker` for that show.

`ListEpisodePicker` is already generic: its props are `tvId`, `showTitle`, `have`,
`onAdd` and `onClose`, with no list-specific coupling. The poll picker should reuse it
rather than build a parallel one, which also keeps the two features behaving identically.

### Finding 4: the genre cull already works for episodes, unchanged

`computeSurvivors` and `topTierGenres` in `src/lib/poll-cull.ts` are pure and operate on
a map of ids to `{ genreIds, title }`. An episode inherits its show's genres, so a
mixed-show ballot culls exactly as it does today.

Within a single show the cull degenerates: every episode shares the show's genres, so one
genre is the top tier and nothing is eliminated. That is already the documented fallback
behaviour for a ballot with no genre separation, and round 2 becomes a straight runoff. No
special case is needed.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Episode identity | `(titleId, seasonNumber, episodeNumber)`, `0/0` = whole title | Matches `list_items` and `episode_watches` exactly |
| Option key | `"{titleId}:{season}:{episode}"` | A text key can express both kinds; a uuid array cannot |
| Picker | Reuse `ListEpisodePicker` | It already does this job, see Finding 3 |
| Cull | Unchanged, episodes inherit show genres | Finding 4 |
| Ballot scope | Any episode of any show, mixed with titles | Chosen over one-show-per-poll and over cross-show episode search |
| Winner link | The episode URL shipped on 2026-08-18 | `/title/tv/{tmdbId}-{slug}/s{n}e{n}` |

## Architecture

### Schema

Three changes, all backward compatible with existing rows.

**`poll_votes`** gains, mirroring `list_items`:

```ts
seasonNumber: integer("season_number").notNull().default(0),
episodeNumber: integer("episode_number").notNull().default(0),
episodeName: text("episode_name"),
```

The existing unique constraint on `(pollId, voterKey, round)` is unchanged: still one vote
per voter per round.

**`polls.round2TitleIds`** (`uuid[]`) is replaced by `round2OptionKeys` (`text[]`) holding
option keys.

**`polls`** gains `winnerSeasonNumber` and `winnerEpisodeNumber`, both
`integer not null default 0`, alongside the existing `winnerTitleId`.

### Migration

Generated with `drizzle-kit generate`. Existing rows need no data change: the new integer
columns default to 0, which is exactly "whole title" under the convention.

`round2_title_ids` needs a one-time backfill into `round2_option_keys`, mapping each uuid
`u` to `"{u}:0:0"`. Only in-flight polls in `round2` status are affected; finished and
round-1 polls read the column but its contents no longer matter.

### Option keys

One helper module, `src/lib/poll-option.ts`, pure and unit tested:

```ts
export function optionKey(titleId: string, season = 0, episode = 0): string;
export function parseOptionKey(key: string): { titleId: string; season: number; episode: number } | null;
export function isEpisode(key: string): boolean;
```

Every place that currently passes a bare `titleId` between poll functions passes a key
instead. Keys are internal: they are never user input, so `parseOptionKey` is a guard
against corrupt data rather than untrusted input.

### Service changes, `src/services/polls.ts`

**`castVote(slug, voter, mediaType, tmdbId, season?, episode?)`.** When a season and
episode are given:

- Reject them when `mediaType` is `movie`.
- Resolve the show with the existing `getOrCreateTitle`, unchanged.
- Confirm the episode exists using `oneEpisode` from `src/services/tv-season.ts`, which is
  already cached per season and returns null for an unknown season or episode. Reject with
  a 404-shaped `PollError` when null.
- Capture `episode.name` into `episodeName` so rendering a ballot needs no live TMDB call
  per option, which is the same reason `list_items` denormalises it.

Round-2 validation changes from `round2TitleIds.includes(title.id)` to
`round2OptionKeys.includes(optionKey(...))`.

**`loadTitles` becomes `loadOptions`.** It takes option keys, selects the distinct
`titleId`s from `titles` once, and expands each key back into a display row. For an
episode the row carries the show poster (consistent with the episode share card),
`title` rendered as `"{show}: S{n}E{m} {episode name}"`, and `href` pointing at the
episode URL. `genreIds` come from the show, which is what makes Finding 4 hold.

**`closeRound1` and `closeRound2`** tally by key rather than by title id. The round-2
tiebreak (votes, then TMDB rating, then title) is unchanged, with rating still coming from
the show.

**`PollOption`** gains `seasonNumber`, `episodeNumber` and `episodeName`, and `titleId`
becomes `key`. `PollViewState.myPick` and `winner` gain the same fields.

### Contract, `src/lib/contracts/polls.ts`

`castVoteInput` is currently `titleRef`, which is shared with other endpoints, so it must
not be modified in place. Extend it locally instead:

```ts
export const castVoteInput = titleRef.extend({
  seasonNumber: z.number().int().min(1).max(999).optional(),
  episodeNumber: z.number().int().min(1).max(9999).optional(),
});
```

Bounds match `parseEpisodeSlug` in `src/lib/tmdb/detail.ts` so the two agree on what counts
as a plausible episode. Supplying one without the other is a validation error.

### UI

`MoviePicker` in `src/components/poll/MoviePicker.tsx` gains the "Episodes" affordance that
`ListEditor` already has: on a TV result, a button that opens `ListEpisodePicker` inline for
that show, with `onAdd` casting the vote for that episode instead of the show.

`PollRoom` renders an episode option as the show poster plus
`"{show}: S{n}E{m} {episode name}"`, and links it to the episode page. The blind-round,
reveal and winner states need no structural change, only the richer label.

## Error handling

| Case | Behaviour |
| --- | --- |
| Season or episode sent for a movie | 400, validation error |
| Only one of season or episode sent | 400, validation error |
| Episode does not exist on TMDB | 404 `PollError`, "That episode does not exist" |
| Episode voted for after round-1 cull removed it | 409, the existing "eliminated in round 1" error |
| A show is deleted from `titles` while a poll references it | Existing behaviour, the option is dropped from display |
| Corrupt option key in `round2_option_keys` | `parseOptionKey` returns null, the option is skipped rather than crashing the ballot |

## Testing

**`src/services/polls.ts` has no tests today.** Only the pure `src/lib/poll-cull.test.ts`
exists. That matters more than it first appears, because this design renames the identifier
threaded through every function in that service, in code that decides who won a vote.

So the first implementation step is not the schema. It is a characterisation test file,
`src/services/polls.test.ts`, pinning the CURRENT behaviour before anything changes:
a round-1 vote, the auto-advance when the round fills, the genre cull picking survivors,
a round-2 runoff, the tiebreak, and the "only round-1 voters" and "already full" guards.
Those tests should pass untouched after the refactor, apart from the identifier rename.
If they do not, the refactor changed behaviour it was not supposed to.

Write them against the real database the way `src/services/shuffle.test.ts` does, seeding
rows with a `__vitest__` prefix, and mock only the TMDB client.

New pure tests, `src/lib/poll-option.test.ts`:

- Round trip for a whole title and for an episode.
- `parseOptionKey` rejects malformed input.
- `isEpisode` distinguishes `0:0` from a real episode.

New service tests, added after the characterisation set is green:

- A vote for an episode stores the season, episode and captured name.
- A vote for a nonexistent episode is rejected, using a mocked `oneEpisode`.
- A ballot mixing an episode and a whole title culls and tallies correctly.
- Two episodes of the same show are two distinct options, not one.
- Round 2 rejects an option key that was culled.
- The winner records its season and episode.

Cull tests: rename the id field and add a case proving two episodes of one show both
survive, since they share the show's genres.

## Out of scope

- **Cross-show episode search.** Deliberately deferred on 2026-08-18. It needs a persistent
  episode index and a cron to populate it, which is a standing cost with no demand evidence.
  The two-step picker means a poll can still mix shows.
- Seeding a ballot up front. Options are still whatever voters pick in round 1.
- Changing the round structure, the genre cull algorithm, or the tiebreak.

## Risks

| Risk | Mitigation |
| --- | --- |
| The `round2_title_ids` backfill misses an in-flight poll | Only polls in `round2` status are affected; verify the count before and after, and prefer running it when no poll is mid-round |
| Renaming `titleId` to `key` touches many call sites at once, in an untested service that decides vote outcomes | Characterisation tests first, see Testing. The type change also makes every site a compile error, so the compiler enumerates the work |
| An episode ballot in one show produces a large round 2 | Existing documented behaviour for a ballot with no genre separation, not new. Revisit only if it proves annoying in use |
| Episode names drift after capture | Same tradeoff `list_items` already accepts, and the reason it denormalises too |
