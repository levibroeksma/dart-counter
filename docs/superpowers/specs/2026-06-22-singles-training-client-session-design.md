# Singles Training Client Session Design

**Date:** 2026-06-22  
**Status:** Approved (2026-06-22 — resume/abandon removed; matches score training)  
**Reference:** `docs/superpowers/specs/2026-06-19-score-training-client-session-design.md`

## Problem

Singles Training currently persists an active session in `game_sessions` and makes API calls on **every dart** and **undo**. Each interaction blocks the UI (`loading: true`) while waiting on the network and DB. Stats and session deletion happen inline on the terminal dart POST, coupling game-end latency to the last input.

A `Summary.astro` component exists but the play flow does not match score training's completion UX: no summary skeleton during persistence, no separation between terminal game state and stats save, and `playAgain()` creates a new DB session via API instead of rebuilding client-side.

## Goal

Mirror the score-training client-session architecture for singles training:

1. Hold in-progress session state in Alpine `$persist` (sessionStorage).
2. Validate settings server-side on game start via form POST.
3. Apply darts and undo **locally** — zero API calls during play.
4. Persist to the database **only on game completion** (stats + play count).
5. Show a proper end-of-game summary panel with skeleton loading during the completion API, and client-side **play again** with the same settings.

## Score Training Flow (reference)

```
Settings (GET)
  └─ form POST → /games/score-training

Play page
  POST: validate settings → buildScoreTrainingSession → embed in HTML
  GET:  Alpine $persist restores from sessionStorage (redirect to settings if absent)

During play (client-only)
  submitScore / undo / timer → shared state functions
  $persist auto-syncs to sessionStorage
  zero API calls

On completion
  showSummary = true, summary = null → SummarySkeleton
  POST /api/games/score-training/complete
    ├─ validate completed session
    ├─ save stats + increment play count
    └─ return summary
  clear sessionStorage persist

playAgain()
  buildScoreTrainingSession(same settings) — no API
```

## Singles Training Today (gap)

| Area | Current | Target |
| ---- | ------- | ------ |
| Game start | `POST /api/games/singles-training/session` → DB write → redirect | Form POST to play route → embed session in HTML |
| In-progress state | `game_sessions` row, read on every page load | Alpine `$persist` in sessionStorage |
| Dart submit | `POST session/dart` → DB write every dart | `applyDartToSession()` locally |
| Undo | `DELETE session/dart/last` → DB write | `revertLastDart()` locally |
| Game end | Terminal dart POST saves stats + deletes session inline | Local terminal state → `POST /complete` |
| Play again | `POST session/play-again` → new DB session | `buildSinglesTrainingSession(settings)` client-side |
| Settings resume/abandon | Active-session banner + API DELETE | Removed — refresh restores via `$persist` |
| Play count | `incrementPlayCount` on play-page GET | On completion only (with stats) |
| Summary UX | `showSummary` set when terminal dart API returns; `loading` blocks all controls | `showSummary` immediately on terminal; skeleton while completion API runs; summary panel when API returns |
| Leave game | Navigate away (DB session orphaned until abandon) | Clear persist key on confirm leave |

## Decisions

| Decision | Choice |
| -------- | ------ |
| Settings → play handoff | Form POST to `/games/singles-training`; Astro validates and embeds initial session |
| Play count increment | On completion only (with stats save) |
| Active session storage (DB) | Removed — no `game_sessions` reads/writes for singles-training |
| In-progress persistence | Alpine `$persist(...).as('singles-training-session').using(sessionStorage)` |
| Leave game | Clear persist key on confirm leave; no DB cleanup |
| Refresh during play | Restored automatically by Alpine persist |
| Resume/abandon UI | Removed (refresh replaces resume) |
| Random direction | Re-shuffle `targetSequence` on each new session (start + play again) |
| Scope | Singles Training only; other games unchanged |
| Skeleton loading | Reuse `Skeleton.astro`; add singles-specific play shell + summary skeletons |
| Summary component | Extend existing `Summary.astro`; wire like score training (`showSummary && summary`) |

## Architecture

```
Settings page (GET)
  └─ <form method="POST" action="/games/singles-training">

Play page
  POST: parse formData → validate → buildSinglesTrainingSession → render Play (embed session)
  GET:  render Play shell → Alpine $persist restores from sessionStorage (redirect to settings if absent)

During play (Alpine, client-only)
  session: Alpine.$persist(...).as('singles-training-session').using(sessionStorage)
  submitDart / undoDart → shared lib state functions (persist auto-syncs)
  zero API calls (until completion)

On completion (status dead or completed)
  showSummary = true, summary = null → SummarySkeleton
  POST /api/games/singles-training/complete
    ├─ validate terminal session server-side
    ├─ savePlayerSinglesTrainingStats
    ├─ incrementPlayCount
    └─ return summary
  clear sessionStorage persist

playAgain()
  buildSinglesTrainingSession(session.settings) — client only, no API
```

## Perceived Latency & Skeleton Loading

Dart submit and undo become synchronous client updates — no per-input loading spinner.

| Phase | Trigger | Visible UI |
| ----- | ------- | ---------- |
| `hydrating` | HTML painted → Alpine `init()` not finished | Play shell skeleton |
| `playing` | `ready === true`, `!showSummary` | ScorePanel, TargetLabel, DartInput |
| `completing` | Terminal status reached, `summary === null` | Summary skeleton |
| `summary` | Completion API returned | Summary panel with stats + play again |

### `ready` lifecycle (`singles-training.play.ts`)

```
ready: false  (initial)

init():
  1. If POST embedded session → assign to $persist session, overwrite stale persist
  2. Else if $persist session valid and status === 'active' → use it (refresh path)
  3. Else → redirect to settings (before ready)
  4. ready = true
```

Play template orchestration (mirror score training):

- `x-show="!ready"` — `PlayShellSkeleton`
- `x-show="ready && !showSummary"` + `x-cloak` — live play chrome
- `x-show="showSummary && !summary"` — `SummarySkeleton`
- `Summary showSummaryModel="showSummary && summary"` — live summary with play-again buttons

`aria-busy="true"` on play `<section>` while `!ready || (showSummary && !summary)`.

## Components

### New shared (`src/lib/shared/games/singles-training/`)

- **`form-data.ts`** — `parseSinglesTrainingSettingsFormData(formData)` → raw settings object
- **`session-factory.ts`** — `buildSinglesTrainingSession(settings)` creates in-memory session (target sequence + initial state; no DB)
- **`completion.ts`** — `validateCompletedSinglesTrainingSession(session)` verifies shape, settings, terminal status (`dead` \| `completed`), dartHistory integrity, score/segment consistency

### Server

- **`src/pages/games/[game].astro`** — POST handler for singles-training (parallel to score-training); remove `getSinglesTrainingSession` guard on GET; remove `incrementPlayCount` for singles-training on page load
- **`src/pages/api/games/singles-training/complete.ts`** — sole persistence endpoint (new)
- **`src/pages/games/settings-[game].astro`** — remove active-session check for singles-training

### Client

- **`singles-training.play.ts`** — refactor: `$persist` session; local `submitDart` / `undoDart`; `persistCompletion()` on terminal; client `playAgain()`; `ready` gate; `clearPersistedSinglesTrainingSession()` on leave/completion
- **`singles-training.settings.ts`** — simplify to form POST submit (like score-training settings); remove `start()` fetch, `resume()`, `abandon()`

### UI

- **`PlayShellSkeleton.astro`** — layout-matched placeholder for ScorePanel + TargetLabel + DartInput
- **`SummarySkeleton.astro`** — reuse score-training pattern or singles-specific variant (more stat rows)
- **`Play.astro`** — add `x-init="init()"`, skeleton/live swap, `gameSession` optional/null on GET
- **`Summary.astro`** — already exists; pass `loadingModel`; ensure `showSummaryModel="showSummary && summary"`
- **`SinglesTrainingSettingsShell.astro`** — remove resume/abandon banner; plain form POST

### Removed

- `src/pages/api/games/singles-training/session.ts`
- `src/pages/api/games/singles-training/session/dart.ts`
- `src/pages/api/games/singles-training/session/dart/last.ts`
- `src/pages/api/games/singles-training/session/play-again.ts`
- `src/lib/server/data/singles-training-session.ts`

**Retained:** `src/lib/server/data/player-singles-training-stats.ts`

## Data Flow

### Game start

1. User configures settings on `/games/settings-singles-training`
2. Form POSTs to `/games/singles-training`
3. Server validates settings via `validateSinglesTrainingSettings`
4. Server builds session via `buildSinglesTrainingSession` (shuffles if `direction === 'random'`)
5. `Play.astro` renders skeleton; receives `gameSession` from POST
6. Alpine `init()`: assign POST session or hydrate from `$persist`; set `ready = true`

### During play

- `submitDart(outcome)`: validate outcome locally → `applyDartToSession` → if terminal (`dead` \| `completed`): `showSummary = true` → `persistCompletion()`
- `undoDart()`: `revertLastDart` (always allowed when `dartHistory.length > 0` and not in summary)
- Refresh: GET reloads play page → `$persist` hydrates → game continues

### Game completion

- Client POSTs full session to `/api/games/singles-training/complete`
- Server validates session is genuinely terminal and dart data is consistent
- Server saves stats and increments play count
- Client shows `SummarySkeleton` while API in flight; replaces with summary from API response
- Client clears persist storage on successful completion

### Play again

- User clicks **Yes** on summary (only visible when `summary` is populated — completion already saved)
- `playAgain()`: `buildSinglesTrainingSession(session.settings)` → reset UI state → no fetch
- Random direction: new shuffled sequence each time

## Completion Validation (server)

`validateCompletedSinglesTrainingSession` must verify:

- Valid session shape (`isSinglesTrainingSession`)
- Valid settings
- `state.status` is `dead` or `completed`
- `dartHistory` length > 0 (or allow 0 only if impossible terminal — prefer require at least one dart)
- Each dart record: valid target index, dartInVisit sequence, outcome valid for target in `targetSequence`
- Recomputed score and `segmentCounts` match `state`
- Terminal conditions: `completed` iff all 21 targets cleared; `dead` iff mode minimum hits failed on a visit
- `targetSequence` matches `buildTargetSequence(settings.direction)` for non-random, or is a valid permutation of all 21 targets for random

## Error Handling

| Scenario | Behavior |
| -------- | -------- |
| Invalid POST settings | Redirect to settings with `?error=invalid-settings` |
| GET play page with no persisted session | Skeleton briefly; `init()` redirects to settings |
| Refresh during active game | `$persist` restores from sessionStorage |
| Completion API failure | Error in play UI; session stays in Alpine + persist; user can retry completion |
| Leave game (confirmed) | Clear persist key, navigate to `/games` |
| Invalid dart outcome (client) | Silently ignore or inline validation (existing `isValidOutcomeForTarget`) |

## Summary Panel

Existing `Summary.astro` fields remain:

| Field | Source |
| ----- | ------ |
| Headline | `dead` → "Game Over"; `completed` → "Game Complete" |
| Score, segment counts, hit ratio, dart position rates | `summary` from completion API |

Actions:

- **No** → `/games` (disabled while `loading`)
- **Yes** → `playAgain()` (disabled while `loading`)

## Out of Scope

- Server islands
- Other games (ten-up-one-down)
- `game_sessions` table migration/cleanup for other slugs
- Per-game history records
- Changing scoring/mode/direction rules

## Testing

| Layer | Coverage |
| ----- | -------- |
| `form-data.ts` | Parse direction, mode, scoring from FormData |
| `session-factory.ts` | Builds valid session; random shuffle length 21 |
| `completion.ts` | Valid terminal sessions; reject active, tampered score, invalid dart sequence |
| Alpine play | `ready` after init; local dart/undo; terminal triggers completion fetch; `playAgain` no fetch; leave clears persist |
| Completion API | Auth, validation, stats save, play count |
| Play assembly | POST handoff; skeleton markup; no DB session imports |
| Settings assembly | Form POST action; no resume/abandon banner |
| Remove obsolete | session/dart/play-again API tests |

## Migration Notes

- `SinglesTrainingSessionSuccess` API type may be simplified or removed from client play flow; completion response type mirrors score training (`{ ok: true, summary }`).
- Assembly tests referencing `getSinglesTrainingSession` in `[game].astro` must be updated to match score-training POST/GET pattern.
- `errors.constants.ts`: ensure `GAME_NOT_COMPLETE` used for non-terminal completion attempts (already exists from score training).
