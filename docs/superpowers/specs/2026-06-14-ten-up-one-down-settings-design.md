# Ten Up One Down — Settings & Session Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-14  
**Branch:** TBD  
**Scope:** Settings form requirements, typed settings, game session model, round tracking, global player stats, undo — for the `ten-up-one-down` game mode

---

## 1. Overview

Define the data model and requirements for **Ten Up One Down** so a game can be configured, started, played (one submission per round), and tracked for progress and lifetime statistics.

**Game summary:**

| Rule | Value |
|---|---|
| Players | 1 |
| Darts per round | 3 |
| Starting target | 41 (always) |
| Goal | Finish current target in ≤3 darts (double-out) |
| Success | Checkout in 1–3 darts → target +10 |
| Failure | No checkout / bust → target −1 |
| Min / max target | 2 / 170 |
| Bogey numbers | 169, 168, 166, 165, 163, 162, 159 |
| Default end | 10 rounds |

**User flow:**

1. `/games/settings-ten-up-one-down` — configure end mode (rounds or timed); form always shows defaults
2. If in-progress session exists → prompt: resume or abandon & start new
3. Start → create game session (settings + initial state) → `/games/ten-up-one-down`
4. Play — one modal submission per round (success/failure + tracking fields)
5. Optional undo last round (unlimited consecutive)
6. Game ends → session deleted; settings not remembered for next game

| Item | Value |
|---|---|
| Stack | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript |
| Storage | Netlify Blobs via data layer (swappable for DB later) |
| Settings persistence | Active game session only — not saved for new games |
| Stats persistence | Global per player, across all game modes |

---

## 2. Settings form requirements

### User-configurable fields

| Field | Type | When | Default | Validation |
|---|---|---|---|---|
| `endMode` | `"rounds" \| "timed"` | always | `"rounds"` | required |
| `roundCount` | number | `endMode === "rounds"` | `10` | integer 1–100 |
| `playtimeSeconds` | number | `endMode === "timed"` | `600` (10 min) | integer 300–1800 (5–30 min) |

### Not in form (engine constants)

| Constant | Value |
|---|---|
| `startingTarget` | `41` |
| `dartsPerRound` | `3` |
| `playerCount` | `1` |
| `minTarget` | `2` |
| `maxTarget` | `170` |
| `successDelta` | `+10` |
| `failureDelta` | `−1` |
| `doubleOutRequired` | `true` |
| `bogeyNumbers` | shared module (see §8) |

### Settings type (discriminated union)

```ts
type TenUpOneDownSettings =
  | { endMode: "rounds"; roundCount: number }
  | { endMode: "timed"; playtimeSeconds: number };
```

### In-progress session on settings page

When an active session exists for the user:

- Show banner: *"Game in progress"*
- **Resume** → navigate to play page
- **Abandon & start new** → delete session, show fresh form with defaults

Settings form never pre-fills from a previous completed or abandoned game.

---

## 3. Architecture & data flow

### Session vs config

This game **replaces** the config-only blob pattern from game routing for `ten-up-one-down`. Settings live inside the active session document, not as a separate reusable config.

```
SettingsForm (defaults)
  → validateTenUpOneDownSettings(raw)
  → TenUpOneDownSettings
  → POST create session
      → server: createInitialGameState(settings)
      → persist TenUpOneDownSession
  → redirect /games/ten-up-one-down

Play page
  → load active session (no session → redirect to settings)
  → render from session.state + session.roundHistory

Round submit (modal confirm)
  → POST session/round
      → validate round record
      → resolve target adjustment
      → append to roundHistory
      → update global player stats
      → persist session

Undo last round
  → DELETE session/round/last
      → revert target + roundHistory
      → roll back stats for removed round
      → persist session

Game completed or abandoned
  → delete session
```

### Blob stores

| Store | Key pattern | Contents |
|---|---|---|
| `game-sessions` | `{userId}:ten-up-one-down` | Active `TenUpOneDownSession` |
| `player-dart-stats` | `{userId}` | Global `PlayerDartStats` |

---

## 4. File structure

```
app/src/lib/shared/darts/
  bogeys.ts                    ← BOGEY_NUMBERS, isBogey(), nearestNonBogey()
  doubles.ts                   ← DoubleTarget, ALL_DOUBLES

app/src/lib/shared/stats/
  double-stats.ts              ← applyRoundToStats(), revertRoundFromStats()
  types.ts                     ← PlayerDartStats, PlayerDoubleStats

app/src/lib/shared/games/ten-up-one-down/
  constants.ts                 ← game rules (startingTarget, min/max, deltas)
  settings.ts                  ← TenUpOneDownSettings type
  validation.ts                ← validateTenUpOneDownSettings()
  round.ts                     ← TenUpOneDownRoundRecord, validateRoundRecord()
  state.ts                     ← TenUpOneDownGameState, createInitialGameState()
  target.ts                    ← resolveTargetAfterRound() (+ bogey, bounds)
  session.ts                   ← TenUpOneDownSession type

app/src/lib/server/data/
  ten-up-one-down-session.ts   ← get/save/delete session
  player-dart-stats.ts         ← get/update global stats
```

---

## 5. Session & state types

### Session document

```ts
type TenUpOneDownSession = {
  slug: "ten-up-one-down";
  settings: TenUpOneDownSettings;
  state: TenUpOneDownGameState;
  roundHistory: TenUpOneDownRoundRecord[];
  timeRemainingSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};
```

### Runtime state

No per-dart tracking in state — rounds are atomic.

```ts
type TenUpOneDownGameStatus = "active" | "paused" | "completed";

type TenUpOneDownGameState = {
  currentRound: number;
  currentTarget: number;
  status: TenUpOneDownGameStatus;
  lastAdjustment: "success" | "failure" | null;
};
```

### Initial state (`createInitialGameState(settings)`)

| Field | Value |
|---|---|
| `currentRound` | `1` |
| `currentTarget` | `41` |
| `status` | `"active"` |
| `lastAdjustment` | `null` |
| `timeRemainingSeconds` | `settings.playtimeSeconds` if timed, else `null` |

---

## 6. Round tracking

### Interaction model

User interacts **once per round** (not per dart). After selecting success or failure on the play screen, a **modal** opens for remaining tracking fields. Nothing is persisted until modal confirm. Cancel discards modal state.

### Round record

```ts
type DoubleTarget =
  | "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8" | "D9" | "D10"
  | "D11" | "D12" | "D13" | "D14" | "D15" | "D16" | "D17" | "D18" | "D19" | "D20"
  | "Bull";

type DoubleAttempt = {
  double: DoubleTarget;
  hit: boolean;
};

type TenUpOneDownRoundRecord = {
  roundNumber: number;
  targetAtStart: number;
  targetAfter: number;
  finished: boolean;
  dartsUsed: 1 | 2 | 3;
  doubleAttempts: DoubleAttempt[];
  busted?: boolean;
};
```

### Entry flows

**Success path (modal):**

```
finished: true
  → dartsUsed (1 | 2 | 3)
  → doubleAttempts in order (each miss + final hit)
  → confirm
```

**Failure path (modal):**

```
finished: false
  → dartsUsed (1 | 2 | 3)
  → doubleAttempts in order (all misses; empty if 0 double attempts)
  → busted (yes | no)
  → confirm
```

### Validation rules

| Rule | Detail |
|---|---|
| Success | exactly one `hit: true` in `doubleAttempts` |
| Failure | all `hit: false` (or empty array) |
| Attempt count | `doubleAttempts.length ≤ dartsUsed` |
| Setup darts | `dartsUsed − doubleAttempts.length` (implicit, not stored) |
| `dartsOnDouble ≤ dartsUsed` | setup darts excluded from double attempts |
| `busted` | failure only; stats-only — both busted and non-busted failure apply target −1 |

### Target resolution (after confirm)

1. **Success:** `currentTarget + 10`
2. **Failure:** `currentTarget − 1`
3. If result is bogey → `nearestNonBogey(target, preferHigher)` where `preferHigher = true` on success, `false` on failure; tie-break follows last adjustment direction
4. If below min (2) → clamp to `2`
5. If successful checkout on target **170** → `status: "completed"`
6. Store `targetAfter` on round record; set `currentTarget = targetAfter`
7. Increment `currentRound` unless game ended

### Game end triggers → `status: "completed"`

| Mode | Trigger |
|---|---|
| Rounds | `currentRound > roundCount` after round resolves |
| Timed | Timer hits 00:00 → finish current round normally (+/− adjustment) → then completed |
| Both | Successful checkout on target 170 |

---

## 7. Pause & timer (timed mode only)

| Rule | Detail |
|---|---|
| Availability | Timed mode only; rounds mode has no pause |
| Pause | `status → "paused"`: timer frozen, input blocked |
| Resume | `status → "active"`: timer continues from `timeRemainingSeconds` |
| Timer scope | Total session countdown (`playtimeSeconds`) |
| Timer runs | Only while `status === "active"` |

---

## 8. Shared dart modules

Reusable across current and future game modes.

### `lib/shared/darts/bogeys.ts`

```ts
export const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159] as const;

export function isBogey(target: number): boolean;

/** Snap to nearest non-bogey; tie-break via preferHigher (direction of last adjustment). */
export function nearestNonBogey(target: number, preferHigher: boolean): number;
```

### `lib/shared/darts/doubles.ts`

```ts
export type DoubleTarget = /* D1–D20 + Bull */;

export const ALL_DOUBLES: readonly DoubleTarget[] = [/* 21 values */];
```

---

## 9. Global player stats

Stats are **global per player**, aggregated across all game modes. Updated after each round confirm; rolled back on undo.

```ts
type PlayerDoubleStats = Record<DoubleTarget, { attempts: number; successes: number }>;

type PlayerDartStats = {
  doubleStats: PlayerDoubleStats;
  totalCheckouts: number;
  totalCheckoutDarts: number;
};
```

### Derived metrics

| Metric | Calculation |
|---|---|
| Checkout average | `totalCheckoutDarts / totalCheckouts` |
| Per-double success rate | `successes / attempts` per `DoubleTarget` |
| Favorite double | highest success rate among doubles with ≥1 attempt |
| Worst double | lowest success rate among doubles with ≥1 attempt |

Each `doubleAttempts` entry increments `attempts`; entries with `hit: true` increment `successes`. On success rounds, `totalCheckouts++` and `totalCheckoutDarts += dartsUsed`.

---

## 10. Undo (go back)

| Rule | Detail |
|---|---|
| Scope | Last submitted round only |
| Repeat | Unlimited consecutive undos |
| On undo | Remove last `roundHistory` entry |
| | Revert `currentTarget` to removed round's `targetAtStart` |
| | Roll back that round's contribution from global player stats |
| | Decrement `currentRound` |
| | If `status === "completed"` → restore `"active"` and timer state if applicable |
| Re-submit | Normal modal flow from reverted state |

---

## 11. API routes

Auth required on all routes. Pattern matches existing `ApiResponse`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/games/ten-up-one-down/session` | Create session from validated settings |
| `GET` | `/api/games/ten-up-one-down/session` | Load active session |
| `DELETE` | `/api/games/ten-up-one-down/session` | Abandon session |
| `POST` | `/api/games/ten-up-one-down/session/round` | Submit round record |
| `DELETE` | `/api/games/ten-up-one-down/session/round/last` | Undo last round |

Round submit and undo must update session blob and global stats atomically (same handler; rollback on failure).

### Validation

Shared isomorphic validators in `lib/shared/games/ten-up-one-down/`:

- `validateTenUpOneDownSettings()` — client (before create) and server (on POST session)
- `validateRoundRecord()` — client (before submit) and server (on POST round)

---

## 12. Testing

| Layer | Covers |
|---|---|
| `lib/shared/darts/bogeys.ts` | isBogey, nearestNonBogey, tie-break direction |
| `lib/shared/darts/doubles.ts` | ALL_DOUBLES completeness |
| `lib/shared/stats/double-stats.ts` | apply + revert round stats |
| `lib/shared/games/ten-up-one-down/validation.ts` | settings bounds, endMode branches |
| `lib/shared/games/ten-up-one-down/round.ts` | round record validation rules |
| `lib/shared/games/ten-up-one-down/target.ts` | +10/−1, bogey snap, min clamp, max completion |
| `lib/shared/games/ten-up-one-down/state.ts` | createInitialGameState for both modes |
| Session API routes | create, load, abandon, round submit, undo, auth |
| Undo | consecutive undos, stats rollback, completed → active restore |

### Verification order

```
npm run check  →  npm test  →  npm run build
```

---

## 13. Out of scope

- Play UI layout and modal styling (separate from this spec's data requirements)
- Per-game-mode stats views (stats are stored globally; display is future work)
- Multi-player support
- Configurable starting target
- Per-dart score entry (e.g. T20 + T19 + D12 notation)
- Migrating 501 / 121 to session-based model
- Removing legacy `PUT /api/games/{slug}/config` for other games

---

## 14. Decisions log

| # | Topic | Decision |
|---|---|---|
| 1 | Settings typing | Discriminated union on `endMode` |
| 2 | Settings persistence | Session-only; form always defaults |
| 3 | Starting target | Always 41 — not configurable |
| 4 | Round count bounds | 1–100, default 10 |
| 5 | Playtime bounds | 5–30 minutes, default 10 minutes |
| 6 | End mode | `rounds` or `timed` (mutually exclusive) |
| 7 | Timed mode | Total session countdown |
| 8 | Timer expiry | Finish current round normally, then completed |
| 9 | Pause | Timed mode only |
| 10 | Min target breach | Clamp to 2 |
| 11 | Max target | Successful checkout on 170 → completed |
| 12 | Bogey landing | Snap to nearest non-bogey; tie → adjustment direction |
| 13 | Busted | Stats-only; same −1 as non-busted failure |
| 14 | Round interaction | One submission per round via modal |
| 15 | Double attempts | Each attempt tracked individually (misses + hit) |
| 16 | Double targets | D1–D20 + Bull (shared module) |
| 17 | Bogey numbers | Shared module for reuse across game modes |
| 18 | Stats scope | Global per player, all game modes |
| 19 | Favorite/worst double | No minimum attempt threshold |
| 20 | In-progress on settings | Prompt: resume or abandon & start new |
| 21 | Undo | Last round only; unlimited consecutive undos |
