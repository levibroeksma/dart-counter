# Ten Up One Down Client Session Design

**Date:** 2026-06-22  
**Status:** Draft — pending user review  
**Reference:** `docs/superpowers/specs/2026-06-19-score-training-client-session-design.md`, `docs/superpowers/specs/2026-06-22-singles-training-client-session-design.md`

## Problem

Ten Up One Down persists an active session in `game_sessions` and makes API calls on **every round submit** and **undo**. Each interaction blocks the UI (`loading: true`) while waiting on the network and DB. Stats are saved per round inline, and game completion redirects to `/games` with no end-of-game summary or play-again flow.

Score training and singles training now use a client-session model with a Summary panel, skeleton loading during completion persistence, and client-side play again. Ten Up One Down is the remaining game on the old pattern.

## Goal

Mirror the score-training / singles-training client-session architecture for Ten Up One Down:

1. Hold in-progress session state in Alpine `$persist` (sessionStorage).
2. Validate settings server-side on game start via form POST.
3. Apply rounds and undo **locally** — zero API calls during play.
4. Persist to the database **only on game completion** (player dart stats + play count).
5. Show an end-of-game Summary panel (same component pattern as the other games) with skeleton loading during the completion API, and client-side **play again** with the same settings.

**Preserved:** per-round OptionModal (dart-count questions after score submit). This is round-entry UX, not the end-of-game Summary.

## Decisions

| Decision | Choice |
| -------- | ------ |
| Approach | **A** — full client-session parity with score/singles training |
| Settings → play handoff | Form POST to `/games/ten-up-one-down`; Astro validates and embeds initial session |
| Play count increment | On completion only (with stats save) |
| Active session storage (DB) | Removed — no `game_sessions` reads/writes for ten-up-one-down |
| In-progress persistence | Alpine `$persist(...).as('ten-up-one-down-session').using(sessionStorage)` |
| Leave game | Clear persist key on confirm leave; no DB cleanup |
| Refresh during play | Restored automatically by Alpine persist |
| Resume/abandon UI | Removed (refresh replaces resume) |
| Scope | Ten Up One Down only; other games unchanged |
| Skeleton loading | TUOD-specific play shell + summary skeletons (reuse `Skeleton.astro`) |
| Summary component | New `Summary.astro` using `SummaryStatRow` (same pattern as score/singles) |

### Summary content (user-approved)

| Field | Definition |
| ----- | ---------- |
| Headline | `"170 Checkout!"` when game ends on max-target finish; `"Game Complete"` for rounds/time endings |
| Rounds played | `roundHistory.length` |
| Checkouts | Count of rounds where `finished === true` |
| Double-hit % | `checkouts / sum(round.dartsOnDouble) × 100`, one decimal (matches `applyRoundToStats` semantics: one hit per checkout, attempts = darts on double) |
| Final target | `session.state.currentTarget` at completion |
| Peak target | Highest target reached in progression — max of all `targetAtStart`, all `targetAfter`, and final `currentTarget` across the session |

## Ten Up One Down Today (gap)

| Area | Current | Target |
| ---- | ------- | ------ |
| Game start | `POST /api/games/ten-up-one-down/session` → DB write → redirect | Form POST to play route → embed session in HTML |
| In-progress state | `game_sessions` row, read on every page load | Alpine `$persist` in sessionStorage |
| Round submit | `POST session/round` → DB write + stats every round | `applyRoundToState()` locally after OptionModal |
| Undo | `DELETE session/round/last` → DB write | `revertRoundFromState()` + `revertRoundFromStats` not needed client-side |
| Game end | Redirect to `/games` on `completed: true` | Local terminal state → `POST /complete` → Summary panel |
| Play again | N/A | `buildTenUpOneDownSession(settings)` client-side |
| Settings resume/abandon | Active-session banner + API DELETE | Removed — refresh restores via `$persist` |
| Play count | `incrementPlayCount` on play-page GET | On completion only (with stats) |
| Summary UX | None | `showSummary` immediately on terminal; skeleton while completion API runs; summary panel when API returns |
| Leave game | Navigate away (DB session orphaned until abandon) | Clear persist key on confirm leave |

## Architecture

```
Settings page (GET)
  └─ <form method="POST" action="/games/ten-up-one-down">

Play page
  POST: parse formData → validate → buildTenUpOneDownSession → render Play (embed session)
  GET:  render Play shell → Alpine $persist restores from sessionStorage (redirect to settings if absent)

During play (Alpine, client-only)
  session: Alpine.$persist(...).as('ten-up-one-down-session').using(sessionStorage)
  submitScore → OptionModal → modalSubmit → applyRoundToState locally
  undo → revertRoundFromState locally
  zero API calls (until completion)

On completion (rounds limit / timer / 170 checkout)
  showSummary = true, summary = null → SummarySkeleton
  POST /api/games/ten-up-one-down/complete
    ├─ validate completed session server-side
    ├─ apply all rounds to player dart stats
    ├─ incrementPlayCount
    └─ return summary
  clear sessionStorage persist

playAgain()
  buildTenUpOneDownSession(session.settings) — client only, no API
```

## Perceived Latency & Skeleton Loading

Round submit (after modal) and undo become synchronous client updates — no per-input loading spinner except during completion API.

| Phase | Trigger | Visible UI |
| ----- | ------- | ---------- |
| `hydrating` | HTML painted → Alpine `init()` not finished | Play shell skeleton |
| `playing` | `ready === true`, `!showSummary` | TargetCard, RoundProgress, NumberInputPad, OptionModal |
| `completing` | Game marked complete, `summary === null` | Summary skeleton |
| `summary` | Completion API returned | Summary panel with stats + play again |

### `ready` lifecycle (`ten-up-one-down.play.ts`)

```
ready: false  (initial)

init():
  1. If POST embedded session → assign to $persist session, overwrite stale persist
  2. Else if $persist session valid and status !== 'completed' → use it (refresh path)
  3. Else → redirect to settings (before ready)
  4. ready = true; start timer if timed mode
```

Play template orchestration (mirror score/singles):

- `x-show="!ready"` — `PlayShellSkeleton`
- `x-show="ready && !showSummary"` + `x-cloak` — live play chrome (including OptionModal)
- `x-show="showSummary && !summary"` — `SummarySkeleton`
- `Summary showSummaryModel="showSummary && summary"` — live summary with play-again buttons

`aria-busy="true"` on play `<section>` while `!ready || (showSummary && !summary)`.

## Components

### New shared (`src/lib/shared/games/ten-up-one-down/`)

- **`form-data.ts`** — `parseTenUpOneDownSettingsFormData(formData)` → raw settings object (mirror `tenUpOneDownSettings.formDataToSettings`: `roundCount` as number, `playtimeMinutes` → `playtimeSeconds`)
- **`session-factory.ts`** — `buildTenUpOneDownSession(settings)` creates in-memory session (no DB)
- **`summary.ts`** — `TenUpOneDownSummary` type + `buildSummary(session)` computing approved stat fields and `completionReason`
- **`completion.ts`** — `validateCompletedTenUpOneDownSession(session)` verifies shape, settings, terminal status, roundHistory integrity, target progression
- **`stats.ts`** — `applyGameCompletionToStats(stats, session)` loops `roundHistory` calling existing `applyRoundToStats`

### Server

- **`src/pages/games/[game].astro`** — POST handler for ten-up-one-down (parallel to score-training); remove `getTenUpOneDownSession` guard on GET; exclude ten-up-one-down from play-page `incrementPlayCount`
- **`src/pages/api/games/ten-up-one-down/complete.ts`** — sole persistence endpoint (new)
- **`src/pages/games/settings-[game].astro`** — remove active-session check for ten-up-one-down

### Client

- **`ten-up-one-down.play.ts`** — refactor: `$persist` session; local `modalSubmit` / `undo`; `persistCompletion()` on terminal; client `playAgain()`; `ready` gate; `clearPersistedTenUpOneDownSession()` on leave/completion; remove fetch to round APIs
- **`ten-up-one-down.settings.ts`** — simplify to form POST submit (like score-training settings); remove `start()` fetch, `resume()`, `abandon()`

### UI

- **`PlayShellSkeleton.astro`** — layout-matched placeholder for TargetCard + RoundProgress + NumberInputPad
- **`SummarySkeleton.astro`** — 5 stat rows + play-again CTA placeholder (TUOD-specific `data-testid`)
- **`Summary.astro`** — new; `SummaryStatRow` entries; dynamic headline via `completionReason`; Yes/No play-again (match singles pattern: buttons, `:disabled={loadingModel}`)
- **`Play.astro`** — add skeleton/live swap, optional `gameSession` on GET, wire Summary + skeletons; keep OptionModal inside playing phase
- **`TenUpOneDownSettingsShell.astro`** — remove resume/abandon banner; plain form POST like `ScoreTrainingSettingsShell`

### Removed

- `src/pages/api/games/ten-up-one-down/session.ts`
- `src/pages/api/games/ten-up-one-down/session/round.ts`
- `src/pages/api/games/ten-up-one-down/session/round/last.ts`
- `src/lib/server/data/ten-up-one-down-session.ts`

**Retained:** `src/lib/server/data/player-dart-stats.ts`, `src/lib/shared/stats/double-stats.ts` (`applyRoundToStats` / `revertRoundFromStats` reused server-side in validation replay if needed)

## Data Flow

### Game start

1. User configures settings on `/games/settings-ten-up-one-down`
2. Form POSTs to `/games/ten-up-one-down`
3. Server validates settings via `validateTenUpOneDownSettings`
4. Server builds session via `buildTenUpOneDownSession`
5. `Play.astro` renders skeleton; receives `gameSession` from POST
6. Alpine `init()`: assign POST session or hydrate from `$persist`; set `ready = true`

### During play

- `submitScore()`: resolve outcome → show OptionModal (unchanged)
- `modalSubmit()`: build round record → append to `roundHistory` → `applyRoundToState` locally → if terminal: `showSummary = true`, `stopTimer()`, `persistCompletion()`
- `undo()`: pop last round → `revertRoundFromState` locally (no stats revert client-side)
- Timed mode: mirror score-training timer rules — tick while active and not in summary; on expiry with no pending score/modal, force completion; if score entered or modal open, set `timerExpired` and complete on next `modalSubmit`
- Refresh: GET reloads play page → `$persist` hydrates → game continues

### Game completion

Triggers (unchanged game rules):

| Trigger | `completionReason` |
| ------- | ------------------ |
| Successful checkout at 170 | `checkout170` |
| `endMode === 'rounds'` and round count exceeded | `rounds` |
| `endMode === 'timed'` and timer expired (incl. mid-round flag) | `timed` |

Client POSTs full session to `/api/games/ten-up-one-down/complete`. Server validates, applies all rounds to player dart stats, increments play count, returns summary. Client clears persist on success.

### Play again

- User clicks **Yes** on summary (only when `summary` populated — completion already saved)
- `playAgain()`: `buildTenUpOneDownSession(session.settings)` → reset UI state (`showSummary`, `summary`, `score`, modal fields, `timerExpired`) → restart timer if timed mode
- No API call

## Completion Validation (server)

`validateCompletedTenUpOneDownSession` must verify:

- Valid session shape (`isTenUpOneDownSession`)
- Valid settings via `validateTenUpOneDownSettings`
- `state.status === 'completed'`
- `roundHistory.length >= 1` (at least one round played)
- Each round: `validateRoundRecord` passes; `roundNumber` / `targetAtStart` sequence matches session state replay
- Replaying `applyRoundToState` for each round yields final `state` matching submitted session (including `targetAfter` on each record)
- Terminal condition matches one of:
  - Last round finished at 170 (`completedOn170`)
  - Rounds mode: `roundHistory.length === settings.roundCount` and game completed via round limit
  - Timed mode: timer exhausted (session may end mid-progression; `timeRemainingSeconds <= 0` or implied by last round + timed flag)

Reject active sessions, tampered targets, or mismatched round counts.

## Error Handling

| Scenario | Behavior |
| -------- | -------- |
| Invalid POST settings | Redirect to settings with `?error=invalid-settings` |
| GET play page with no persisted session | Skeleton briefly; `init()` redirects to settings |
| Refresh during active game | `$persist` restores from sessionStorage |
| Completion API failure | Error in play UI; `showSummary` stays true, `summary` stays null (skeleton visible); session remains in Alpine + persist for manual refresh/retry |
| Leave game (confirmed) | Clear persist key, navigate to `/games` |
| Invalid score (client) | `resolveRoundOutcome` returns null — no modal (unchanged) |
| Modal submit with invalid dart counts | `modalCanSubmit` guard (unchanged) |

## Summary Panel

`Summary.astro` fields:

| Label | Source |
| ----- | ------ |
| Headline | `summary.completionReason === 'checkout170'` → `"170 Checkout!"`; else `"Game Complete"` |
| Rounds played | `summary.roundsPlayed` |
| Checkouts | `summary.checkouts` |
| Double-hit % | `summary.doubleHitPercentage.toFixed(1) + '%'` |
| Final target | `summary.finalTarget` |
| Peak target | `summary.peakTarget` |

Actions (match singles-training Summary):

- **No** → `window.location.href='/games'` (`:disabled` while `loading`)
- **Yes** → `playAgain()` (`:disabled` while `loading`)

## API Types

Add to `src/lib/shared/api/types.ts`:

```typescript
export type TenUpOneDownCompleteSuccess = {
  ok: true;
  summary: TenUpOneDownSummary;
};
```

Remove or stop using `TenUpOneDownSessionSuccess` in client play flow after migration.

## Out of Scope

- Changing target rules, checkout constraints, or OptionModal question logic
- `game_sessions` table migration/cleanup for other slugs or orphaned TUOD rows
- Per-game history records
- Extracting shared play-shell abstractions across all three games
- Server islands

## Testing

| Layer | Coverage |
| ----- | -------- |
| `form-data.ts` | Parse `endMode`, `roundCount`, `playtimeMinutes` → `playtimeSeconds` |
| `session-factory.ts` | Builds valid session; timed vs rounds `timeRemainingSeconds` |
| `summary.ts` | Peak target across progression; double-hit %; `completionReason` variants |
| `completion.ts` | Valid terminal sessions; reject active, tampered targets, invalid round sequence |
| `stats.ts` | All rounds applied to player dart stats on completion |
| Alpine play | `ready` after init; local modalSubmit/undo; terminal triggers completion fetch; timer expiry; `playAgain` no fetch; leave clears persist |
| Completion API | Auth, validation, stats save, play count |
| Play assembly | POST handoff; skeleton markup; no `getTenUpOneDownSession` in `[game].astro` |
| Settings assembly | Form POST action; no resume/abandon banner |
| Remove obsolete | session/round API tests; `ten-up-one-down-session` data layer tests |

## Migration Notes

- Existing in-progress DB sessions for ten-up-one-down become unreachable after deploy (acceptable; same as score/singles migration).
- `scripts/curl-verify-tuod.sh` must be updated for `/complete` flow instead of round POST chain.
- `[game].astro` TUOD branch: pass `gameSession` from POST or `null` on GET (like score-training), not server-fetched session.
- `incrementPlayCount` guard: extend `slug !== "score-training" && slug !== "singles-training"` to exclude `ten-up-one-down`.
