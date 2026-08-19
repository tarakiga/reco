# React hooks lint cleanup design

**Date:** 2026-08-19
**Status:** Draft, needs review before implementation planning

## Goal

Get `npm run lint` to zero problems without breaking behaviour.

The repo currently reports 27 problems across 20 files: 23 errors and 4 warnings. Almost
all of them come from the React Compiler era `react-hooks` rules, which are newer than most
of the code they flag. The errors are not style nits: each marks a pattern that React now
considers a correctness risk, mostly around cascading renders and hydration.

The trap this spec exists to avoid: these look like lint errors, so they invite a
mechanical sweep. They are not. Nineteen of them are behavioural refactors of client
components that have no test coverage, on the highest traffic pages in the app. A careless
sweep would be a large, invisible regression surface.

## Inventory

Counts are from `npx eslint src --ext .ts,.tsx` on 2026-08-19, after the `SeasonsAccordion`
purity fix in `e92db2b`.

### react-hooks/set-state-in-effect (19 errors, 14 files)

| File | Lines |
| --- | --- |
| `src/components/catalog/SeasonsAccordion.tsx` | 321, 330, 445 |
| `src/components/layout/CommandPalette.tsx` | 49, 60 |
| `src/components/guide/GuideClient.tsx` | 105, 134 |
| `src/components/account/AccountTabs.tsx` | 25, 46 |
| `src/components/account/ListEditor.tsx` | 46 |
| `src/components/account/DiaryManager.tsx` | 36 |
| `src/components/account/ListEpisodePicker.tsx` | 38 |
| `src/components/layout/SearchAutocomplete.tsx` | 45 |
| `src/components/layout/MobileMenu.tsx` | 20 |
| `src/components/person/FilmographyModal.tsx` | 20 |
| `src/components/poll/MoviePicker.tsx` | 29 |
| `src/components/rank/RankTool.tsx` | 59 |
| `src/components/home/WrappedBanner.tsx` | 38 |
| `src/components/analytics/ConsentBanner.tsx` | 37 |

### react-hooks/purity (3 errors, 2 files)

| File | Lines |
| --- | --- |
| `src/components/guide/AddToCalendar.tsx` | 32, 36 |
| `src/app/title/[mediaType]/[idSlug]/page.tsx` | 140 |

### react-hooks/refs (1 error)

`src/components/poll/PollRoom.tsx:42`

### jsx-a11y/alt-text (3 warnings)

`src/app/title/[mediaType]/[idSlug]/og/route.tsx`,
`src/app/title/[mediaType]/[idSlug]/[episode]/og/route.tsx`,
`src/app/api/share/rating/route.tsx`

### Unused eslint-disable directive (1 warning)

`src/components/guide/GuideClient.tsx:175` suppresses `react-hooks/exhaustive-deps`, which
no longer reports anything there. This is the one problem in the whole list that
`eslint --fix` can resolve on its own.

Worth noting what it implies: someone silenced a dependency warning, the underlying code or
the rule later changed, and the now pointless directive sat there unnoticed. That is the
failure mode a disable comment invites, and it is why Group D below requires a written
justification on any disable rather than a bare directive.

## The 19 are not 19 problems

Grouping by the pattern that causes them is what makes this tractable. Each group has one
fix shape, so the work is four decisions rather than nineteen.

### Group A: mirroring fetched data into local state

An effect copies React Query data, or a fetch result, into `useState`. The state is a
duplicate of something that already lives in the query cache, and the effect exists only to
keep the copy in sync.

Sites: `SeasonsAccordion:445`, `ListEditor:46`, `DiaryManager:36`, `ListEpisodePicker:38`,
`MoviePicker:29`, `FilmographyModal:20`, `SearchAutocomplete:45`, `RankTool:59`.

Fix shape: stop mirroring. Read the query data directly and keep local state only for the
genuinely local part, which is usually an optimistic overlay of pending user edits. Where
an optimistic overlay is needed, hold only the diff, not a full copy.

This is the largest group and the highest value: it removes a whole class of "local copy
went stale" bugs, not just the lint error.

### Group B: resetting state when a prop changes

An effect watches a prop and calls setState to reset local state.

Sites: `AccountTabs:25` and `46`, `MobileMenu:20`.

Fix shape: React's documented answer is either to derive the value during render, or to
remount with a `key` when the identity changes. `key` is usually the smaller change.

### Group C: client only values behind a hydration guard

An effect sets a flag or reads a browser only value after mount so that the server and
client first paint agree.

Sites: `ConsentBanner:37`, `WrappedBanner:38`.

Fix shape: `useSyncExternalStore` with a constant server snapshot is the sanctioned
hydration safe way to answer "am I on the client". Note it cannot wrap a live clock,
because the snapshot must be stable, so a time value must come from a prop instead. That is
the pattern already used in `e92db2b`, where the title page passes `todayYmd` down.

### Group D: genuine effects with a timer or scroll

The setState is the point of the effect, not a sync.

Sites: `SeasonsAccordion:321` and `330`, `GuideClient:105` and `134`, `CommandPalette:49`
and `60`.

Fix shape: case by case. Some can move into event handlers. `SeasonsAccordion:321` opens a
deep linked season and could be derived, but naive derivation breaks the case where the user
closes a season they deep linked to, so it needs a "user has toggled" flag. Others, like a
flash that fades after 2000ms, are legitimately timers and may warrant a documented
`eslint-disable-next-line` rather than a contortion.

**This group is where a disable comment is an acceptable outcome.** The rule exists to catch
cascading renders. Where an effect genuinely synchronises with a timer or the scroll
position, and the dependencies are correct, silencing it with a one line justification is
better engineering than restructuring working code to satisfy a linter. Groups A, B and C
should not use disables.

## The purity three

These are different in kind and worth doing first, because each is a real hydration bug
rather than a shape objection.

`AddToCalendar.tsx:32` and `36` and `page.tsx:140` read the clock during render, so the
server and client can evaluate them at different instants and disagree. The fix is the one
already applied to `SeasonsAccordion`: resolve the value once on the server and pass it in
as a prop, comparing ISO date strings, which sort chronologically.

Check each of the three before assuming. If a value is only used inside an event handler or
an effect, moving the read there is simpler than threading a prop.

## The alt-text three

All three are `<img>` inside Satori OG image routes. An `alt` attribute on an element that
is rasterised into a JPEG is meaningless: there is no DOM for a screen reader to read.

Recommendation: do not add fake alt text. Add a scoped override in the eslint config
disabling `jsx-a11y/alt-text` for OG route files, with a comment explaining that these files
render images rather than markup. That is honest about why the rule does not apply, and it
stops the warning recurring every time a new card is added.

## Testing strategy

This is the part that decides whether the cleanup is safe, and it is the reason this needs
its own project rather than being done opportunistically.

None of the 18 files has a test today. Refactoring untested components is how working
behaviour disappears quietly.

The rule for implementation: **write a test that pins the current behaviour before changing
each component, not after.** If the behaviour is genuinely untestable in the current setup,
that is a signal to leave the component alone and use a documented disable instead.

The repo has the pieces already. `vitest` with jsdom and Testing Library is configured, and
`TitleCard.test.tsx`, `Modal.test.tsx`, `StarRating.test.tsx` and `Toast.test.tsx` show the
house style for component tests. Storybook stories exist for some of these components and
run under `@storybook/addon-vitest`, which is a second option for pinning render output.

Priority for tests: Group A components, because "does the list still show the right items
after the query resolves" is exactly what a mirroring refactor can break, and it is
straightforward to assert.

## Sequencing

Each phase should land and be verified before the next starts. Each is independently
shippable.

1. The purity three, since they are real hydration bugs and the fix shape is already proven.
2. The alt-text override plus `eslint --fix` for the stale directive, both config or
   mechanical, minutes rather than hours.
3. `react-hooks/refs` in `PollRoom`, a single site, to be assessed on its own.
4. Group B, three sites, smallest behavioural change.
5. Group C, two sites.
6. Group A, eight sites, tests first, one component per commit.
7. Group D last, deciding disable versus refactor per site, since by then the pattern
   library from the earlier phases will make the call obvious.

## Risks

| Risk | Mitigation |
| --- | --- |
| A mirroring refactor silently drops optimistic updates | Test the optimistic path explicitly before touching Group A |
| Deep link and scroll behaviour breaks with no test to catch it | Group D allows documented disables rather than forcing a refactor |
| A large sweep lands as one unreviewable commit | One component per commit, phases land separately |
| The rules change again in a future plugin release | Prefer fixes that are correct React, not fixes that merely satisfy the current rule |

## Out of scope

- Turning any of these rules off globally. The rules are catching real patterns, and the
  goal is a clean lint run, not a quiet one.
- Adding tests to components not touched by this work.
- The two known unrelated test failures: a Storybook Clerk provider issue in
  `PageShell.stories.tsx`, and load related flakiness in the full suite.
