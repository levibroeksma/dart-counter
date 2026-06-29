# Score Training Client Session Design

**Date:** 2026-06-19
**Status:** Approved (refined — skeleton loading)

## Problem

Score Training currently persists an active session in the database and makes API calls on every round, undo, and timer event. This adds latency and unnecessary DB load. Active sessions in the DB are not needed — in-progress state lives client-side instead.

## Goal

Move in-game session state to Alpine.js client state. Validate settings server-side on game start via form POST. Persist to the database only on game completion (stats + play count).

## Decisions

| Decision                    | Choice                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Settings → play handoff     | **B:** Form POST to play route; Astro validates and embeds initial session in HTML     |
| Play count increment        | On completion only (with stats save)                                                   |
| Active session storage (DB) | Removed — no `game_sessions` reads/writes for score-training                           |
| In-progress persistence     | Alpine `$persist(...).as(key).using(sessionStorage)` — survives refresh, not server/DB |
| Leave game                  | Progress discarded — clear persist key on confirm leave                                |
| Refresh during play         | Restored automatically by Alpine persist                                               |
| Resume/abandon UI           | Removed (refresh replaces resume)                                                      |
| Scope                       | Score Training only; other games unchanged                                             |
| Client loading UX           | Static Astro skeleton shells until Alpine `ready`; summary skeleton during completion API |

## Architecture

```
Settings page (GET)
  └─ <form method="POST" action="/games/score-training">

Play page
  POST: parse formData → validate → buildScoreTrainingSession → render Play (embed session)
  GET:  render Play shell → Alpine $persist restores from sessionStorage (redirect to settings if absent)

During play (Alpine, client-only)
  session: Alpine.$persist(...).as(key).using(sessionStorage)
  submitScore / undo / timer → shared lib state functions (persist auto-syncs)
  zero API calls (until completion)

On completion
  POST /api/games/score-training/complete
    ├─ validate completed session server-side
    ├─ savePlayerScoreTrainingStats
    ├─ incrementPlayCount
    └─ return summary
```

## Perceived Latency & Skeleton Loading

### Problem

Play UI binds scores, timer, and summary through Alpine (`x-text`, `x-show`). Until Alpine boots and `$persist` hydrates, those regions render empty. On game completion, summary stats wait on the completion API. Both gaps hurt perceived latency even when the shell HTML has already arrived.

Round submit and undo are client-only in this design — no network wait — so they do **not** need loading skeletons.

### Approach

**Static skeleton shells in Astro** (server HTML) swap to live Alpine UI once the play controller sets `ready: true`. A reusable `Skeleton` primitive keeps markup DRY. Skeletons mirror existing layout dimensions so the swap does not shift the page.

| Phase        | Trigger                                      | Visible UI                          |
| ------------ | -------------------------------------------- | ----------------------------------- |
| `hydrating`  | HTML painted → Alpine `init()` not finished  | Play shell skeleton (full chrome)   |
| `playing`    | `ready === true`, `!showSummary`             | ProgressBar, ScoreCard, NumberInputPad |
| `completing` | Game marked complete, `summary === null`     | Summary skeleton inside summary slot |
| `summary`    | Completion API returned                      | Summary panel with stats            |

### `ready` lifecycle (`score-training.play.ts`)

```
ready: false  (initial)

init():
  1. If POST embedded session → assign to $persist session, overwrite stale persist
  2. Else if $persist session valid → use it (refresh path)
  3. Else → redirect to settings (no skeleton flash: redirect before ready)
  4. ready = true; start timer if timed mode
```

Play template orchestration:

- `x-show="!ready"` — `PlayShellSkeleton` (static Astro, no Alpine data required)
- `x-show="ready && !showSummary"` + `x-cloak` — live play chrome
- Summary: `x-show="showSummary && !summary"` — `SummarySkeleton`; `x-show="showSummary && summary"` — live summary

`aria-busy="true"` on the play `<section>` while `!ready || (showSummary && !summary)`.

### Skeleton primitive

**`src/components/ui/Skeleton.astro`**

- Props: `variant: "text" | "bar" | "block"`, optional `class`
- Renders a `span`/`div` with `.skeleton` utility
- `aria-hidden="true"` (decorative placeholders)

**`src/styles/global.css`** — add `.skeleton`:

- Rounded block using `bg-white/10` (matches `game-panel` surfaces)
- Subtle opacity pulse via `animate-pulse` or a custom shimmer keyed to `--duration-ui`
- `@media (prefers-reduced-motion: reduce)` — static block, no animation

### Per-component skeletons

| Component | Skeleton file | Placeholder shape |
| --------- | ------------- | ----------------- |
| Play chrome | `PlayShellSkeleton.astro` | Composes below; matches `Play.astro` flex layout |
| Progress | `ProgressBarSkeleton.astro` | Single bar ~40% width + optional pause-button block |
| Score card | `ScoreCardSkeleton.astro` | Label bar, large score block, three stat bars |
| Input pad | `NumberInputPadSkeleton.astro` | Score row bar + 4×3 grid of square blocks |
| Summary | `SummarySkeleton.astro` | Title bar + 4 definition-list row pairs |

Skeleton components are **pure static Astro** — no `x-data`, no `x-show`. Parent `Play.astro` toggles visibility against live siblings.

### What does not get a skeleton

- Settings page — form fields are server-rendered; only `endMode` toggle uses Alpine
- Round submit / undo — synchronous client state updates
- Leave button / header — static in HTML; always visible

### Out of scope (skeletons)

- Skeleton pattern for other games (ten-up-one-down, singles-training) — may reuse `Skeleton.astro` later
- View Transitions / cross-fade between skeleton and live UI — instant swap is sufficient for v1

## Components

### Shared (`src/lib/shared/games/score-training/`)

- **`form-data.ts`** — `parseScoreTrainingSettingsFormData(formData)` converts form fields (`playtimeMinutes` → `playtimeSeconds`)
- **`session-factory.ts`** — `buildScoreTrainingSession(settings)` creates in-memory session (no DB)
- **`completion.ts`** — `validateCompletedScoreTrainingSession(session)` verifies shape, settings, completed status, roundHistory integrity

### Server

- **`src/pages/games/[game].astro`** — POST handler for score-training; GET renders play shell (client restores from sessionStorage)
- **`src/pages/api/games/score-training/complete.ts`** — sole persistence endpoint (replaces session/round/complete routes)

### Client

- **`app.factory.ts`** — register `@alpinejs/persist` plugin
- **`score-training.play.ts`** — `ready` flag; `session` via `$persist(...).using(sessionStorage)`; local round/undo/timer; single fetch on completion; `showSummary` before `summary` triggers summary skeleton
- **`score-training.settings.ts`** — simplified; only `endMode` toggle for Alpine x-model on radio cards

### UI (skeletons)

- **`Skeleton.astro`** — reusable placeholder primitive
- **`PlayShellSkeleton.astro`** — full play chrome placeholder until `ready`
- **`ProgressBarSkeleton.astro`**, **`ScoreCardSkeleton.astro`**, **`NumberInputPadSkeleton.astro`**, **`SummarySkeleton.astro`** — layout-matched placeholders
- **`Play.astro`** — skeleton/live swap via `ready` and `showSummary && !summary`

### Removed

- `src/pages/api/games/score-training/session.ts`
- `src/pages/api/games/score-training/session/round.ts`
- `src/pages/api/games/score-training/session/round/last.ts`
- `src/pages/api/games/score-training/session/complete.ts`
- `src/lib/server/data/score-training-session.ts`

## Data Flow

### Game start

1. User fills settings form on `/games/settings-score-training`
2. Form POSTs to `/games/score-training`
3. Server reads `Astro.locals.session` for auth (middleware)
4. Server validates settings, builds session object
5. `Play.astro` renders `PlayShellSkeleton` immediately; receives optional `gameSession` prop from POST
6. Alpine `init()`: assign POST session or rely on `$persist` hydrate; set `ready = true`; skeleton hides, live UI shows
7. `$persist` auto-syncs session to `sessionStorage`; POST session overwrites any stale persist value in `init()`

### During play

- `session` is Alpine reactive state wrapped in `$persist(...).as('score-training-session').using(sessionStorage)`
- `submitScore`: build round → validate locally → `applyRoundToState` → push to `roundHistory` (persist auto-syncs)
- `undo`: pop round → `revertRoundFromState` (persist auto-syncs)
- **Refresh**: GET reloads play page → `$persist` hydrates from `sessionStorage` → game continues
- Timer expiry: mark `state.status = "completed"` locally → `showSummary = true` → summary skeleton → call completion API

### Game completion

- Client POSTs full session to `/api/games/score-training/complete`
- Server validates session is genuinely complete and round data is consistent
- Server saves stats and increments play count
- Client shows `SummarySkeleton` while API in flight; replaces with summary from API response
- Client clears persist storage on successful completion

## Error Handling

| Scenario                                | Behavior                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------ |
| Invalid POST settings                   | Redirect to settings with `?error=invalid-settings`                      |
| GET play page with no persisted session | Skeleton visible briefly; `init()` redirects to settings before `ready`    |
| Refresh during active game              | `$persist` restores from `sessionStorage`                                |
| Completion API failure                  | Show error in play UI; session stays in Alpine + persist; user can retry |
| Leave game (confirmed)                  | Clear persist key, navigate away; no DB cleanup                          |

## Out of Scope

- Server islands (future pass)
- Other games (ten-up-one-down, singles-training)
- `game_sessions` table migration/cleanup
- Persisting individual game history records

## Testing

- Unit tests for form-data parser, session factory, completion validator
- Alpine play tests: `ready` after `init()` with session; redirect when absent; client-side round/undo/timer; completion fetch with summary skeleton gap
- Completion API tests: auth, validation, stats save, play count
- Play assembly tests: POST handoff; static skeleton markup in HTML; no persisted session imports
- Skeleton primitive: variant rendering; reduced-motion static fallback
- Remove obsolete session/round API tests
