# reco v1 Design — Phase 0 (Platform Foundation) + Phase 1 (Catalog MVP)

**Date:** 2026-06-12
**Status:** Approved by owner (pending spec review)
**Working codename:** `reco` — final product name undecided; all naming must be trivially replaceable (single source for brand strings via the config system, no hardcoded brand text in components).

---

## 1. Background & Vision

reco is the ground-up successor to **rizmos** (a 2021-era WordPress movies/TV review site at `D:\wamp64\www\rizmos`, kept untouched as reference). The long-term vision is a **community entertainment platform** (users rate, review, and build lists) with an **AI taste layer** as the moat: explainable taste profiles, spoiler-aware personalization, conversational discovery.

### Product phasing (agreed)

| Phase | Scope | Status |
|---|---|---|
| **0** | Platform foundation: stack, design system, component library, auth, config system + admin UI | **This spec** |
| **1** | Catalog MVP: TMDB-backed title/person pages, cast search, streaming availability, watchlists, ratings | **This spec** |
| 2 | Community layer: user reviews, lists/charts, profiles, follows | Future spec |
| 3 | AI taste layer: taste DNA (pgvector embeddings), match scores, taste import, semantic search, concierge | Future spec |
| 4 | Differentiators: spoiler-aware progress scoping, living reviews, group watch mediator, trailer intelligence | Future spec |

v1 = Phase 0 + Phase 1. It must be launchable and useful on its own (Reelgood-parity catalog experience) while Phases 2–4 are built behind it.

### Build-guide compliance (binding constraints)

This project follows the owner's build guide (`D:\work\Tar\PROJECTS\AMCHAM\CLAUDE.md`). Key obligations:

- **No hardcoded changeable values.** All dynamic content, options, UI labels, and legal/marketing text live in the database and are manageable via a role-gated admin UI with draft/publish, version history, editor attribution, and rollback.
- **Design tokens are the single source of truth.** No raw hex colors, pixel values, or ad-hoc font declarations outside the token layer.
- **Centralized component library** with Storybook documentation; no one-off page-local UI.
- **Zod-typed contracts** validated client- and server-side.
- **Env hygiene:** `.env.example` tracked, `.env.local` ignored; app boots without local overrides.
- **Integrations:** Neon (Postgres) for backend, Cloudinary for file storage.
- **Tracking:** `task-list.md` and `handoff.md` maintained in the repo root.

---

## 2. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router, TypeScript), deployed on Vercel | RSC for public pages, API routes for contracts |
| Database | Neon Postgres, **pgvector enabled at creation** | Build guide mandates Neon; pgvector is free now and avoids a Phase 3 migration |
| ORM | **Drizzle** | Typed schema + SQL-first migrations; pairs with Neon serverless driver |
| Auth | **Clerk** | Role-gated admin out of the box (roles required by build guide), 10k free MAU, native Vercel integration. Veto-checked vs Auth.js; owner approved |
| File storage | Cloudinary | User uploads only (avatars now; list covers in Phase 2). Catalog images hotlink TMDB CDN with attribution — never re-hosted |
| Styling | Tailwind v4 with `@theme` tokens | Tokens as CSS variables = the build guide's token layer; components consume only tokens |
| Validation | Zod (shared schemas, client + server) | Build-guide contract requirement |
| Client data | React Query (admin UI); RSC + fetch caching (public pages) | Cache-busting on publish per build guide |
| Component workshop | Storybook | Every library component documented before page use |
| Catalog data | TMDB API | Titles, people, credits, search, watch providers |
| Availability data | TMDB watch-providers endpoint (JustWatch data, free, attribution required) | Watchmode is the upgrade path for deep links — hidden behind the same interface |
| Testing | Vitest (lib + components), Playwright (e2e smoke) | |

---

## 3. Data Architecture

### 3.1 Lazy catalog mirror (load-bearing decision)

TMDB is the catalog source of truth, mirrored **lazily** into Postgres. No bulk ingestion.

- First view of a title/person → fetch from TMDB → upsert local row → serve from DB.
- Each mirrored row stores `tmdb_id`, key display fields (denormalized for lists/cards), full `metadata` JSONB, and `refreshed_at`.
- **Refresh policy:** stale-while-revalidate. Serve the local row immediately; if `refreshed_at` is older than the staleness window (a config value, default 7 days), trigger a background re-fetch.
- **Why a local mirror at all:** watchlists/ratings need stable FKs; Phase 2 reviews and Phase 3 embeddings hang off these rows; insulates against TMDB rate limits and outages.

### 3.2 Search (v1)

TMDB multi-search (titles + people in one call) proxied through our API. Cast/person search comes free with this. No local search index in v1; semantic search is Phase 3.

### 3.3 Streaming availability

- Source: TMDB `/watch/providers` per title (JustWatch-powered). **JustWatch + TMDB attribution rendered wherever availability is shown.**
- Region-aware: region comes from the user's profile setting (default region is a config value).
- v1 UI: provider logos grouped by stream/rent/buy, linking to the TMDB-provided JustWatch link.
- The availability fetcher is an interface (`AvailabilityProvider`); Watchmode can replace TMDB behind it later without UI changes.

---

## 4. Database Schema (core tables)

### 4.1 Config system (build-guide requirement)

- **`config_namespaces`** — id, key, description.
- **`config_options`** — id, namespace_id, key, label, value (JSONB), sort_order, enabled, status (`draft | published`), created/updated timestamps, updated_by.
- **`content_blocks`** — id, key, title, body_richtext, status (`draft | published`), updated_by, updated_at.
- **`config_versions`** — append-only history: entity_type, entity_id, snapshot JSONB, version, updated_by, updated_at. Powers version history + rollback for both options and content blocks.
- **`audit_log`** — actor, action, entity_type, entity_id, diff JSONB, timestamp.

Draft/publish workflow: edits write a draft; publishing snapshots to `config_versions`, flips status, and bumps a namespace cache tag so clients refetch immediately.

### 4.2 Identity & user data

- **`profiles`** — id, clerk_user_id (unique), username (unique), avatar_url, region, role (`user | editor | admin`), created_at. Clerk owns credentials/sessions; this table owns app-facing identity.
- **`titles`** — id, tmdb_id (unique), media_type (`movie | tv`), slug (unique), title, release_year, poster_path, backdrop_path, overview, metadata JSONB, refreshed_at.
- **`people`** — id, tmdb_id (unique), slug (unique), name, profile_path, metadata JSONB, refreshed_at.
- **`watchlist_items`** — user_id, title_id, status (`want_to_watch | watching | watched`), added_at, updated_at. PK (user_id, title_id).
- **`ratings`** — user_id, title_id, score (integer 1–10, displayed as 5 stars with halves), rated_at. PK (user_id, title_id).

Slugs are generated at mirror time (`title-year` / `name`, de-duplicated with numeric suffix) and never change once created.

---

## 5. API Contracts

All request/response shapes are Zod schemas in a shared `lib/contracts` module; the same schemas validate server-side input and type client responses. Versioned under `/api/v1`.

### Public, read-only (cached)
- `GET /api/v1/titles/[slug]` — title detail incl. cast strip + availability for a `?region=`
- `GET /api/v1/people/[slug]` — person + filmography
- `GET /api/v1/search?q=&type=` — multi-search proxy (titles + people)
- `GET /api/v1/config/[namespace]` — published config for a namespace (cache-tagged; revalidated on publish)

### Authenticated (Clerk session)
- `GET/PUT/DELETE /api/v1/me/watchlist` — list / upsert status / remove
- `GET/PUT/DELETE /api/v1/me/ratings`
- `GET/PATCH /api/v1/me/profile` — username, avatar (Cloudinary), region

### Admin (role: editor/admin)
- `GET/POST/PATCH/DELETE /api/v1/admin/config/options`
- `GET/POST/PATCH /api/v1/admin/config/content-blocks`
- `POST /api/v1/admin/config/publish` — publish draft(s), snapshot version, bust cache
- `POST /api/v1/admin/config/rollback` — restore a `config_versions` snapshot as a new draft
- `GET /api/v1/admin/config/versions?entity=`

All admin mutations: server-side validation (length, format, duplicate keys, empty states — publishing an empty/invalid config is rejected), audit-logged.

Public pages render via RSC reading the same service layer directly (no client waterfall); the API routes exist for client mutations and as the stable external contract.

---

## 6. Pages

| Route | Content |
|---|---|
| `/` | Hero + trending/popular rails (TMDB trending), CTA to sign up |
| `/movies`, `/tv` | Browse/discover grid with filters: genre, year, provider (filter option lists are config-driven) |
| `/title/[type]/[slug]` | Poster/backdrop, synopsis, metadata, cast strip (→ person pages), where-to-watch panel (region-aware, attributed), trailer embed (YouTube key from TMDB), star rating + watchlist actions |
| `/person/[slug]` | Photo, bio, known-for, full filmography (→ title pages) |
| `/search` | Combined titles + people results with type tabs |
| `/watchlist` | Authed user's items grouped by status |
| `/profile/[username]` | Public profile shell (avatar, watchlist counts) — fuller profiles in Phase 2 |
| `/admin` | Config management: option lists (add/edit/disable/reorder), content blocks (rich text), draft/publish, version history + rollback, audit view. Role-gated |
| Auth | Clerk-hosted components (sign in/up, user button) |

---

## 7. Design System & Component Library

**Tokens first** (Tailwind v4 `@theme`): color palette (dark-first, cinema-leaning; semantic tokens for surface/text/border/accent/success/warn/danger), type scale, spacing scale, radii, shadows, breakpoints. No raw values outside this layer.

**Initial components** (each with Storybook stories — name, purpose, props, variants — before page use):
Button, Input, Select, Badge, Tabs, Modal, Toast, Skeleton, EmptyState, PageShell (header/nav/footer layout), Rail (horizontal scroller), TitleCard, PersonCard, StarRating (display + interactive), ProviderLogoRow (with attribution), FilterBar.

Pages compose exclusively from the library + layout primitives. Repeated layout patterns get factored into layout components.

---

## 8. Error Handling & Fallbacks

- **TMDB outage / rate limit:** serve the local mirror where a row exists (even if stale); otherwise skeleton + retry UI. TMDB client has timeout, retry-with-backoff, and a circuit-breaker flag.
- **Empty config:** every config consumer has safe in-code defaults; an unpopulated config system renders a working site, never an error.
- **Availability missing:** "No streaming info for your region" empty state — never a broken panel.
- **Public API:** rate-limited; all inputs validated server-side regardless of client validation.
- **Images:** TMDB image failures fall back to a placeholder component.

## 9. Testing

- **Vitest:** TMDB client (mocked HTTP), config service (draft/publish/rollback invariants), slug generation, contract schemas.
- **Component tests:** Button, Input, StarRating, Modal, FilterBar.
- **Playwright smoke:** search → open title page → sign in → rate + add to watchlist → see it on `/watchlist`.

## 10. Environment & Git Hygiene

- `.env.example` tracked (placeholders for `DATABASE_URL`, Clerk keys, `TMDB_API_KEY`, Cloudinary keys); `.env.local` and `*.local.*` gitignored before any env file is created.
- App boots in production/CI without local overrides.
- No secrets ever committed.

## 11. Project Tracking

- `task-list.md` — living checklist of v1 tasks, updated as work progresses.
- `handoff.md` — appended after each completed task: what was done, decisions made, where to pick up.

---

## 12. Decisions Log

| # | Decision | Alternatives considered | Status |
|---|---|---|---|
| 1 | Clerk for auth | Auth.js (free, more wiring) | Owner approved |
| 2 | Drizzle ORM | Prisma | Owner approved |
| 3 | TMDB/JustWatch availability data (free) for v1 | Watchmode (paid, deep links) — kept as drop-in upgrade path | Owner approved |
| 4 | Lazy catalog mirroring | Bulk TMDB ingestion | Owner approved |
| 5 | Project location `D:\work\Tar\PROJECTS\reco`, fresh git repo, throwaway codename | — | Owner approved |
| 6 | Direction B: community platform (user-generated ratings/reviews) over editorial site | Direction A (editorial, AI-personalized) | Owner approved |

## 13. Out of Scope for v1

- User reviews, lists/charts, follows (Phase 2)
- All AI features: embeddings, match scores, taste import, semantic search, concierge (Phase 3)
- Spoiler-aware scoping, living reviews, group mediator, trailer intelligence (Phase 4)
- WordPress content migration (revisit in Phase 2 when reviews exist)
- WooCommerce/shop functionality from the old site (dropped)
- Anime-specific sections, news/streaming editorial pages from the old site (revisit post-v1)
