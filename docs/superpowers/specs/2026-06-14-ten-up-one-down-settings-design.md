# Ten Up One Down — Settings & Session Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-14  
**Branch:** TBD  
**Scope:** Settings form, typed settings, game session model, play UI (inline round-entry wizard), round tracking, global player stats, undo — for the `ten-up-one-down` game mode

**UI reference:** `app/src/components/games/ten-up-one-down/Play.astro` (raw prototype — positive flow)

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
4. Play — inline wizard per round (success/failure + tracking fields); Submit persists round
5. Optional undo last submitted round (unlimited consecutive)
6. Game ends → session deleted; settings not remembered for next game

| Item | Value |
|---|---|
| Stack | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript |
| Storage | Netlify Blobs via data layer (swappable for DB later) |
| Settings persistence | Active game session only — not saved for new games |
| Stats persistence | Global per player, across all game modes |
| Round entry UX | Inline wizard in main controls panel (not a modal) |

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
| `bogeyNumbers` | shared module (see §11) |

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

Round submit (inline wizard Submit)
  → buildRoundRecord(wizardInput) on client
  → POST session/round
      → validate round record
      → resolve target adjustment
      → append to roundHistory
      → update global player stats
      → persist session
  → reset wizard to step 1; update target card + progress bar

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
  checkouts.ts                 ← getCheckoutHint(target) — lookup map

app/src/lib/shared/stats/
  double-stats.ts              ← applyRoundToStats(), revertRoundFromStats()
  types.ts                     ← PlayerDartStats, PlayerDoubleStats

app/src/lib/shared/games/ten-up-one-down/
  constants.ts                 ← game rules (startingTarget, min/max, deltas)
  settings.ts                  ← TenUpOneDownSettings type
  validation.ts                ← validateTenUpOneDownSettings()
  round.ts                     ← RoundRecord, deriveSuccessAttempts(), deriveFailureAttempts(), buildRoundRecord(), validateRoundRecord()
  state.ts                     ← TenUpOneDownGameState, createInitialGameState()
  target.ts                    ← resolveTargetAfterRound() (+ bogey, bounds)
  session.ts                   ← TenUpOneDownSession type

app/src/lib/client/alpine/games/
  ten-up-one-down.play.ts      ← wizard step state, back nav, submit, undo, timer

app/src/components/games/ten-up-one-down/
  Play.astro                   ← shell layout; mounts Alpine factory
  TargetCard.astro             ← target score + checkout hint
  RoundProgress.astro          ← round counter / countdown + pause
  RoundEntryWizard.astro       ← inline wizard step templates
  DartCountPicker.astro        ← reusable 1/2/3 (or 0/1/2/3) pill row
  DoubleGrid.astro             ← D1–D20 + Bull from ALL_DOUBLES

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

## 6. Round tracking (data model)

### Interaction model

User interacts **once per round** (not per dart). The play screen uses an **inline wizard** in the main controls panel — steps replace panel content with slide transitions. Nothing is persisted until **Submit**. Wizard step-back is allowed before Submit; the bottom **Go back** bar undoes the last **submitted** round only.

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

### Derivation helpers (UI → record)

The UI collects wizard fields; helpers produce `doubleAttempts` before POST.

**Success** — user picks `onDouble` (1–3) and `finishedOnDouble`:

```ts
function deriveSuccessAttempts(
  onDouble: 1 | 2 | 3,
  finishedOnDouble: DoubleTarget
): DoubleAttempt[] {
  return [
    ...Array(onDouble - 1).fill({ double: finishedOnDouble, hit: false }),
    { double: finishedOnDouble, hit: true },
  ];
}
```

| `onDouble` | Result |
|---|---|
| 1 | 1× hit on `finishedOnDouble` |
| 2 | 1× miss + 1× hit on same double |
| 3 | 2× miss + 1× hit on same double |

**Failure** — user picks `onDouble` (0–3) and optionally `doubleAttempted`:

```ts
function deriveFailureAttempts(
  onDouble: 0 | 1 | 2 | 3,
  doubleAttempted: DoubleTarget | null
): DoubleAttempt[] {
  if (onDouble === 0 || !doubleAttempted) return [];
  return Array(onDouble).fill({ double: doubleAttempted, hit: false });
}
```

### Validation rules

| Rule | Detail |
|---|---|
| Success | exactly one `hit: true` in `doubleAttempts` |
| Failure | all `hit: false` (or empty array) |
| Attempt count | `doubleAttempts.length ≤ dartsUsed` |
| Setup darts | `dartsUsed − doubleAttempts.length` (implicit, not stored) |
| `onDouble ≤ dartsUsed` | setup darts excluded from double attempts |
| `busted` | failure only; stats-only — both busted and non-busted failure apply target −1 |

### Target resolution (after Submit)

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

## 7. Play screen layout

Reference: `Play.astro` prototype.

```
┌─────────────────────────────────┐
│  Ten Up One Down                │  ← title
├─────────────────────────────────┤
│  TARGET                         │
│  41                             │  ← session.state.currentTarget
│  [ 9  D16 ]                     │  ← checkout hint (lookup map)
├─────────────────────────────────┤
│  Round 3 of 10                  │  ← rounds mode
│  Round 3 · 12:34  [⏸ Pause]  │  ← timed mode (countdown, not up)
├─────────────────────────────────┤
│  [ Inline wizard — §8 / §9 ]    │  ← main controls panel
├─────────────────────────────────┤
│  [↩ Go back]                    │  ← undo last submitted round
└─────────────────────────────────┘
```

- Fixed shell; only wizard panel content changes per step
- Slide transition: dart-count steps slide out → double grid slides in (per prototype)
- **Wizard back:** step-level navigation before Submit
- **Go back bar:** round-level undo after Submit

### Round progress bar

| Mode | Display |
|---|---|
| Rounds | `Round N of M` |
| Timed | `Round N · MM:SS` countdown + inline pause/resume toggle |

Timer counts **down** from `playtimeSeconds`. Pause freezes countdown and disables wizard controls.

---

## 8. Inline wizard — success flow

| Step | UI | Validation |
|---|---|---|
| 1 | `Target hit?` → **Yes** / No | — |
| 2 | `Darts used:` 1 / 2 / 3 | required |
| 3 | `Darts on double:` 1 / 2 / 3 | required; `onDouble ≤ dartsUsed` |
| → | Steps 2–3 slide out | both selected |
| 4 | `Finished on double:` D1–D20 + Bull grid (`DoubleGrid`) | required |
| 5 | **Submit** | enabled when step 4 complete |

**Wizard back:** any step → previous (4→3→2→1→ Yes/No).

**On Submit:** `buildRoundRecord()` → POST round → reset wizard to step 1 → update target card + progress.

---

## 9. Inline wizard — failure flow

| Step | UI | Validation |
|---|---|---|
| 1 | `Target hit?` → Yes / **No** | — |
| 2 | `Darts thrown:` 1 / 2 / 3 | required |
| 3 | `Darts on double:` 0 / 1 / 2 / 3 | required; `onDouble ≤ dartsUsed` |
| 4a | If `onDouble > 0` → `Double attempted:` grid | required |
| → | Steps 2–4a slide out (same as success) | |
| 4b | If `onDouble === 0` → skip double grid | — |
| 5 | `Busted?` Yes / No | required |
| 6 | **Submit** | enabled when complete |

**Wizard back:** same as success.

**On Submit:** derive attempts via `deriveFailureAttempts()` → POST round → target −1 → reset wizard. `busted` is stats-only.

---

## 10. Pause & timer (timed mode only)

| Rule | Detail |
|---|---|
| Availability | Timed mode only; rounds mode has no pause |
| Display | `Round N · MM:SS` countdown + pause toggle in progress bar |
| Pause | `status → "paused"`: timer frozen, wizard controls disabled |
| Resume | `status → "active"`: timer continues; wizard state preserved |
| Timer scope | Total session countdown (`playtimeSeconds`) |
| Timer runs | Only while `status === "active"` |

---

## 11. Shared dart modules

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

### `lib/shared/darts/checkouts.ts`

```ts
type CheckoutRoute = { segments: string[] }; // e.g. ["9", "D16"]

export function getCheckoutHint(target: number): CheckoutRoute | null;
```

- Lookup map keyed by target score
- Target card renders segments when entry exists
- Hide hint row when no entry (e.g. bogey targets)

---

## 12. Global player stats

Stats are **global per player**, aggregated across all game modes. Updated after each round Submit; rolled back on undo.

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

## 13. Undo (go back)

| Rule | Detail |
|---|---|
| Scope | Last submitted round only |
| Repeat | Unlimited consecutive undos |
| UI | Bottom bar with undo icon + "Go back" label |
| On undo | Remove last `roundHistory` entry |
| | Revert `currentTarget` to removed round's `targetAtStart` |
| | Roll back that round's contribution from global player stats |
| | Decrement `currentRound` |
| | If `status === "completed"` → restore `"active"` and timer state if applicable |
| Re-submit | Normal inline wizard from reverted state |

Distinct from wizard step-back (pre-Submit, in-panel only).

---

## 14. Components & wizard state

| Component | Responsibility |
|---|---|
| `Play.astro` | Shell layout; mounts `tenUpOneDownPlay(session)` |
| `TargetCard.astro` | Target score + checkout hint |
| `RoundProgress.astro` | Round counter or countdown + pause |
| `RoundEntryWizard.astro` | Inline wizard step templates |
| `DartCountPicker.astro` | Reusable pill row (1/2/3 or 0/1/2/3) |
| `DoubleGrid.astro` | D1–D20 + Bull from `ALL_DOUBLES` |
| `ten-up-one-down.play.ts` | Wizard step state, back nav, submit, undo, timer |

### Wizard step enum

```ts
type WizardStep =
  | "outcome"       // Target hit? Yes / No
  | "dartsUsed"
  | "onDouble"
  | "doubleSelect"  // success: finishedOnDouble; failure: doubleAttempted
  | "busted"        // failure only
  | "submit";
```

Alpine factory registered in `app.factory.ts`. No `<script>` in `.astro` components.

---

## 15. API routes

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
- `deriveSuccessAttempts()` / `deriveFailureAttempts()` — unit-tested derivation

---

## 16. Testing

| Layer | Covers |
|---|---|
| `lib/shared/darts/bogeys.ts` | isBogey, nearestNonBogey, tie-break direction |
| `lib/shared/darts/doubles.ts` | ALL_DOUBLES completeness |
| `lib/shared/darts/checkouts.ts` | getCheckoutHint for known targets |
| `lib/shared/stats/double-stats.ts` | apply + revert round stats |
| `lib/shared/games/ten-up-one-down/round.ts` | deriveSuccessAttempts, deriveFailureAttempts, buildRoundRecord, validation |
| `lib/shared/games/ten-up-one-down/validation.ts` | settings bounds, endMode branches |
| `lib/shared/games/ten-up-one-down/target.ts` | +10/−1, bogey snap, min clamp, max completion |
| `lib/shared/games/ten-up-one-down/state.ts` | createInitialGameState for both modes |
| `lib/client/alpine/games/ten-up-one-down.play.ts` | wizard steps, back nav, submit, undo, pause |
| Session API routes | create, load, abandon, round submit, undo, auth |
| Undo | consecutive undos, stats rollback, completed → active restore |

### Verification order

```
npm run check  →  npm test  →  npm run build
```

---

## 17. Out of scope

- Game-completed summary screen (session ends; redirect TBD in implementation plan)
- Per-game-mode stats views (stats are stored globally; display is future work)
- Multi-player support
- Configurable starting target
- Per-dart score entry (e.g. T20 + T19 + D12 notation)
- Sequential multi-double picker (different doubles per attempt in one round)
- Migrating 501 / 121 to session-based model
- Removing legacy `PUT /api/games/{slug}/config` for other games

---

## 18. Decisions log

| # | Topic | Decision |
|---|---|---|
| 1 | Settings typing | Discriminated union on `endMode` |
| 2 | Settings persistence | Session-only; form always defaults |
| 3 | Starting target | Always 41 — not configurable |
| 4 | Round count bounds | 1–100, default 10 |
| 5 | Playtime bounds | 5–30 minutes, default 10 minutes |
| 6 | End mode | `rounds` or `timed` (mutually exclusive) |
| 7 | Timed mode | Total session countdown (counts down) |
| 8 | Timer expiry | Finish current round normally, then completed |
| 9 | Pause | Timed mode only; inline in progress bar |
| 10 | Min target breach | Clamp to 2 |
| 11 | Max target | Successful checkout on 170 → completed |
| 12 | Bogey landing | Snap to nearest non-bogey; tie → adjustment direction |
| 13 | Busted | Stats-only; same −1 as non-busted failure |
| 14 | Round entry UX | Inline wizard in controls panel (not modal) |
| 15 | Success double attempts | Derived from `onDouble` + `finishedOnDouble` (same double) |
| 16 | Failure double attempts | Derived from `onDouble` + `doubleAttempted` (same double) |
| 17 | Double targets | D1–D20 + Bull (shared module) |
| 18 | Bogey numbers | Shared module for reuse across game modes |
| 19 | Checkout hints | Lookup map per target; shared `checkouts.ts` |
| 20 | Stats scope | Global per player, all game modes |
| 21 | Favorite/worst double | No minimum attempt threshold |
| 22 | In-progress on settings | Prompt: resume or abandon & start new |
| 23 | Undo (Go back bar) | Last submitted round; unlimited consecutive |
| 24 | Wizard back | Step back allowed before Submit |
| 25 | Timed progress bar | `Round N · MM:SS` + pause toggle |
