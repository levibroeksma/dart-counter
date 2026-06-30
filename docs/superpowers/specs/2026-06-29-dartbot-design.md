# DartBot — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-29
**Branch:** TBD
**Scope:** DartBot simulation engine (`lib/shared/dartbot/`) and 501 integration — selectable opponent with level slider, dart-by-dart modal animation, client-side simulation, no bot DB persistence

**UI reference:** `app/src/components/games/501/Play.astro`, `app/src/components/games/501/PlayerPicker.astro`, `app/src/components/games/501/GuestNameModal.astro`, `app/src/components/ui/NumberInputPad.astro`

**Architecture reference:** `design-utils/DartBot-handoff.md`

**Approach:** Standalone `dartbot` module (A) with curated JSON checkout routes + generated fallback (A3)

**Depends on:** 501 game module (`docs/superpowers/specs/2026-06-29-501-design.md`) — session, state machine, settings, play UI

---

## 1. Overview

Add **DartBot** as a selectable 501 opponent. The user configures difficulty via a **level slider (1–15)**. DartBot simulates play **dart-by-dart** on the client; the existing 501 visit state machine still receives visit totals. Only the logged-in user's stats persist to the database — DartBot is treated like a guest for persistence.

**Product summary:**

| Rule             | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Opponent types   | Guest (named) or DartBot (level 1–15)                |
| Simulation       | Client-side only                                     |
| Bot persistence  | None — no DB writes for DartBot                      |
| User persistence | Unchanged — logged-in user stats only                |
| Bot turn UX      | Dart-by-dart modal animation, skippable              |
| Convergence      | Pre-match leg targets only — no mid-match adjustment |
| Checkout routes  | Curated JSON + generated fallback                    |
| Determinism      | Seeded RNG per session — replayable, testable        |

**User flow (DartBot path):**

1. `/games/settings-501` — tap `+` → **OpponentPickerModal** → choose **DartBot** → set level slider → Confirm
2. Configure match format → **Play**
3. Starter screen — tap **You** or **DartBot**
4. User enters visit via `NumberInputPad` → Submit (controls lock)
5. **DartBotTurnModal** — SVG board, ~800ms/dart (300ms on match-winning checkout); tap to skip
6. Bot visit applied via `applyVisit()` → controls unlock if user's turn
7. If DartBot starts (match/leg): auto-trigger after ~500ms delay
8. Match ends → summary (reuse guest stat rows, label "DartBot") → POST user stats only

---

## 2. Decisions log (brainstorming)

| Topic                    | Decision                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Primary use case         | Playable 501 opponent                                                               |
| Architecture             | Standalone `lib/shared/dartbot/` module + thin 501 glue                             |
| Checkout knowledge       | Curated JSON routes + generated fallback (A3)                                       |
| Convergence              | Pre-match only — `MatchPlanner` sets per-leg targets; no mid-match throw adjustment |
| Bot turn UX              | Dart-by-dart animation → visit total submitted                                      |
| Animation surface        | Modal overlay with centered SVG dartboard                                           |
| Animation skip           | User can tap to skip to final visit total                                           |
| Settings                 | `+` opens picker: Guest (name modal) or DartBot (level slider)                      |
| Level granularity        | Interpolate profiles for levels 2–4, 6–9, 11–14 between anchors 1, 5, 10, 15        |
| Simulation runtime       | Client-side in browser                                                              |
| Stats persistence        | User only — DartBot same as guest                                                   |
| Undo                     | Atomic pair — removes last user visit + following bot visit (both must be in history) |
| Undo during bot turn     | Blocked — controls locked from user submit until bot simulation completes             |
| Bot starts first         | Auto-trigger bot turn after ~500ms when DartBot is starter (match or new leg)         |
| Session resume           | Re-simulate from stored RNG state; replay animation (same darts)                      |
| Summary stats            | Reuse existing `guest*` summary fields; label displays opponent name ("DartBot")      |
| Checkout finish          | Strict — finishing dart targets doubles/bull only; invalid finish = bust              |
| Strategy overlap         | Level ≥ 10 → checkout when finishable; below 10 → setup-biased in 131–170 zone        |
| Match-winning checkout   | Abbreviated animation (~300ms/dart) then summary                                     |
| Starter                  | Same screen — user taps You or DartBot                                              |
| Controls during bot turn | `NumberInputPad` and undo locked; leave button available with confirmation          |
| End-of-match validation  | Informational only (±5–10% tolerance); no rubber-banding                            |

---

## 3. Module layout

```text
app/src/lib/shared/dartbot/
├── types.ts                   # Segment, DartResult, SkillProfile, MatchPlan, SimulatedVisit
├── levels.ts                  # LevelProfile anchors + interpolation
├── match-planner.ts           # Pre-match leg targets
├── strategy-engine.ts         # Intent: score | setup | checkout
├── route-engine.ts            # Scoring target selection
├── checkout/
│   ├── bot-checkout-route.ts   # BotCheckoutRoute — not darts/checkouts.CheckoutRoute
│   ├── CheckoutKnowledge.ts
│   ├── checkout-routes.json     # Curated multi-route data
│   ├── GeneratedCheckoutKnowledge.ts
│   ├── CheckoutPolicy.ts
│   ├── CheckoutEvaluator.ts
│   └── CheckoutPlanner.ts
├── throw-engine.ts
├── miss-resolver.ts
├── statistics-engine.ts
├── rng.ts                     # Seeded deterministic RNG
└── dart-bot.ts                # Facade: simulateVisit()

app/src/lib/shared/games/501/
├── settings.ts                # Extend player type with dartbot + level
├── session.ts                 # Add optional botState
└── session-factory.ts         # Initialize botState when dartbot opponent

app/src/components/games/501/
├── OpponentPickerModal.astro
├── DartBotLevelSlider.astro
├── DartBotTurnModal.astro
├── Dartboard.astro
└── PlayerPicker.astro         # Updated for dartbot avatar
```

### Boundary rules

| Layer          | Responsibility                                  | Must NOT               |
| -------------- | ----------------------------------------------- | ---------------------- |
| `dartbot/`     | Throw simulation, levels, checkout routing      | Import 501 modules     |
| `501/state.ts` | Visit application, bust/checkout rules          | Contain throw logic    |
| `501.play.ts`  | Orchestration: when to sim, modal, apply result | Implement miss physics |
| API / DB       | User stats persistence                          | Store DartBot stats    |

---

## 4. Domain model

### Player type extension

```ts
export type FiveOhOnePlayer =
  | { id: string; type: "user"; name: string }
  | { id: string; type: "guest"; name: string }
  | { id: string; type: "dartbot"; name: "DartBot"; level: number };
```

Validation: `level` is integer 1–15.

### Bot session state

```ts
export type FiveOhOneBotState = {
  matchPlan: MatchPlan;
  rngState: number;
  currentLegIndex: number;
};

export type FiveOhOneSession = {
  // existing fields...
  botState?: FiveOhOneBotState; // present when opponent is dartbot
};
```

- Created in `buildFiveOhOneSession()` when a dartbot player is in settings
- Persisted in `sessionStorage` with the session
- Cleared on match complete or leave

### Level system

**Anchors:** explicit `LevelProfile` at levels 1, 5, 10, 15 (values from `DartBot-handoff.md`).

**Interpolation:** levels 2–4, 6–9, 11–14 linearly blend all numeric fields between adjacent anchors.

```ts
export type LevelProfile = {
  level: number;
  threeDartAverage: { min: number; max: number };
  scoringAverage: { min: number; max: number };
  checkout: { average: number; successRate: number };
  execution: {
    hitAccuracy: number;
    missSpread: number;
    checkoutDiscipline: number;
    variance: number;
  };
};

export type SkillProfile = Omit<LevelProfile, "level"> & { level: number };
```

### Match planning

```ts
export type MatchPlan = {
  legTargets: number[]; // per-leg 3DA targets with variance
  skill: SkillProfile;
  seed: number;
};
```

**Input:** resolved `SkillProfile`, estimated leg count (derived from format settings).

**Leg count estimation:**

| Format          | Estimated legs for plan |
| --------------- | ----------------------- |
| Best of N legs  | `N`                     |
| First to N legs | `N`                     |
| Best of N sets  | `N * LEGS_PER_SET`      |
| First to N sets | `N * LEGS_PER_SET`      |

Plan is generated once at session start. If match exceeds estimate, reuse variance algorithm to extend `legTargets`; do not regenerate seed.

**Behavior:**

- Distribute target 3DA across legs with variance (e.g. level 10, 5 legs → 69, 75, 70, 80, 66 → avg 72)
- Seed = deterministic hash of `session.createdAt` + bot level
- Current leg index selects active `legTarget` for strategy bias
- **No runtime adjustment** after plan generation

### Bot checkout route

> **Naming:** `darts/checkouts.ts` already exports `CheckoutRoute { segments: string[] }` for UI hints. DartBot uses `BotCheckoutRoute` in `dartbot/checkout/` to avoid collision.

```ts
export type BotCheckoutRoute = {
  finish: number;
  darts: Segment[];
  quality: number; // higher = more professional
  preferredLeave?: number;
};
```

### Simulated visit

```ts
export type SimulatedDart = {
  target: Segment;
  actual: Segment;
  score: number;
};

export type SimulatedVisit = {
  darts: SimulatedDart[];
  visitScore: number;
  bust: boolean;
  checkout: boolean;
};
```

---

## 5. Simulation engine

### Runtime pipeline

```text
Settings: DartBot + level
    ↓
Session created → MatchPlanner.generate(skill, legCount) → MatchPlan
    ↓
On enter play (or new leg) when currentPlayerId is DartBot:
  wait ~500ms → run bot turn pipeline below
    ↓
Play loop:
  User submits visit → applyVisit() → controls locked
    ↓
  If opponent is DartBot and match continues:
    DartBot.simulateVisit(context, legTarget, rng)
      → StrategyEngine (intent)
      → RouteEngine | CheckoutPlanner (target)
      → ThrowEngine × up to 3 → MissResolver
    ↓
    DartBotTurnModal animates dart sequence (skippable)
    ↓
    applyVisit(botVisitScore)
    ↓
  Repeat
    ↓
Match end → StatisticsEngine.validate() vs LevelProfile (informational)
```

### StrategyEngine

**Input:** remaining score, darts left in visit, leg target, skill level.

**Output:** `"score" | "setup" | "checkout"`

**Overlap rule (131–170, finishable):**

| Level | Intent when both setup and checkout apply |
| ----- | ----------------------------------------- |
| ≥ 10  | `checkout`                                |
| < 10  | `setup` (bias toward preferred leave)     |

**Otherwise:**

| Condition                           | Intent     |
| ----------------------------------- | ---------- |
| `remaining ≤ 170` and finishable    | `checkout` |
| `remaining` in setup zone (131–170) | `setup`    |
| Otherwise                           | `score`    |

Setup intent uses `CheckoutEvaluator` to prefer leaves that enable strong checkout routes.

### RouteEngine (scoring)

- Default target: `T20`
- Shift to `T19` / `T18` based on `missSpread` and leg-target pressure
- Bull attempts rare, gated to higher levels

### Checkout system (A3)

**`CheckoutKnowledge`:** `routes(remaining: number): BotCheckoutRoute[]`

| Source                       | When used                                    |
| ---------------------------- | -------------------------------------------- |
| `checkout-routes.json`       | Curated multi-route finishes, quality-ranked |
| `GeneratedCheckoutKnowledge` | Fallback when JSON has no entry              |

Generated fallback: derive from `checkout-hints.data.ts` / `checkout-solver.ts` — single route, `quality ≈ 70`.

**`CheckoutPolicy`:** `SkillCheckoutPolicy` — sort routes by quality; select index based on `checkoutDiscipline` (high discipline → best route; low → occasional suboptimal).

**`CheckoutPlanner`:** knowledge → policy → selected route.

**Per-dart replanning:** after each throw, recalculate remaining; if still in checkout range, replan route (e.g. 81 → miss S19 → 62 → new route T10 D16).

### ThrowEngine + MissResolver

```ts
throw(target: Segment, skill: SkillProfile, rng: Rng): Segment
```

- `hitAccuracy` → probability of hitting intended segment
- On miss: `MissResolver` picks adjacent segment weighted by `missSpread` (e.g. T20 → S20, T5, etc.)
- Visit stops early on checkout or when 3 darts thrown

**Strict checkout (aligns with `classifyVisit()` / `isFinishableCheckout()`):**

- On a potential finishing dart, ThrowEngine targets **doubles or bull only**
- If resolved segment would leave an invalid finish (e.g. lands on single for checkout, or goes below 0 / leaves 1), the visit is a **bust** — `visitScore` is still the sum attempted, `applyVisit()` handles bust per existing 501 rules
- Bot must never produce a visit that checks out on a non-double/non-bull when `remainingBefore` requires double-out

### StatisticsEngine

Tracks during match: 3DA, scoring average, checkout %, checkout average.

At match end, compare actual vs configured `LevelProfile`:

| Metric           | Tolerance |
| ---------------- | --------- |
| 3DA              | ±5%       |
| Scoring average  | ±5%       |
| Checkout average | ±10%      |
| Checkout %       | ±10%      |

Validation is **informational only** — no correction, no rubber-banding.

### Determinism

- Seeded `Rng` (deterministic PRNG)
- Seed + state stored in `session.botState.rngState`
- Same session + same action sequence → identical bot throws
- Pair undo restores RNG to pre-user-visit state for that pair (see §6)

---

## 6. 501 UI integration

### Settings (align with existing `501.settings.ts` patterns)

**OpponentPickerModal** replaces direct guest modal on `+`:

```text
Tap +  →  OpponentPickerModal
            ├── Guest      → existing GuestNameModal
            └── DartBot    → DartBotLevelSlider (1–15) + Confirm
```

**Refactor player helpers** (currently guest-specific):

| Current | Replace with |
| ------- | ------------ |
| `hasGuest` | `hasOpponent` (`players.length > 1`) |
| `removeGuest()` | `removeOpponent()` — filter `type === "guest"` OR `type === "dartbot"` |
| `openGuestModal()` | `openOpponentPicker()` |
| `confirmGuest()` | unchanged for guest path |

- DartBot avatar: "D" initial, label "DartBot", remove via same ✕ as guest
- Helper text: "Play solo or add an opponent"
- Only one opponent at a time (guest OR dartbot, not both)
- `PlayerPicker.astro`: use `hasOpponent`; show dartbot avatar when `type === "dartbot"`

**Validation (`validation.ts`):** extend `isValidPlayer()`:

```ts
// guest: name required
// dartbot: name === "DartBot", level integer 1–15
```

Required for `validateFiveOhOneSettings()` and `validateCompletedFiveOhOneSession()` replay to accept dartbot sessions.

### Starter screen

Unchanged. DartBot shown as **"DartBot"**. User taps **You** or **DartBot**.

### Play orchestration

```ts
// 501.play.ts

async init() {
  // existing init...
  await this.maybePlayBotTurn();
}

async maybePlayBotTurn() {
  if (!isDartBotTurn(this.session)) return;
  await delay(500);
  await this.runDartBotTurn({ abbreviated: isMatchWinningCheckoutPossible });
}

async submitVisit() {
  // existing applyVisit...
  this.botTurnActive = true; // lock controls immediately after submit
  if (matchContinues && nextPlayerIsDartBot) {
    await this.runDartBotTurn({ abbreviated: false });
  }
  this.botTurnActive = false;
}

async runDartBotTurn(opts) {
  const visit = DartBot.simulateVisit(...); // persists rngState before animation
  await showDartBotTurnModal(visit, {
    skippable: true,
    dartMs: opts.abbreviated ? 300 : 800,
  });
  applyVisit(visit.visitScore);
  if (matchContinues) await this.maybePlayBotTurn(); // chain if bot starts new leg
}
```

**`controlsDisabled`:**

```ts
controlsDisabled = !ready || showSummary || persisting || botTurnActive;
```

- `botTurnActive = true` from user submit until bot visit applied (includes ~500ms starter delay)
- Undo disabled while `botTurnActive`
- Leave button remains available (confirmation modal)

### DartBotTurnModal

| Element       | Behavior                                                     |
| ------------- | ------------------------------------------------------------ |
| Overlay       | Dims play UI; centered modal                                 |
| SVG dartboard | `Dartboard.astro` — dart markers land per segment            |
| Segment label | Text below board: `T20`, `S5`, etc.                          |
| Timing        | ~800ms per dart (default); ~300ms per dart on match-winning checkout |
| Skip          | Tap modal or Skip button → jump to final state → apply visit         |
| On complete   | Close modal, update PlayerPanel stats; match win → summary           |

### Undo (pair semantics)

Extend `501/state.ts` with `revertLastOpponentPair()`:

- **Eligible when:** last two visits in history are `[user, dartbot]` (in that order)
- **Action:** pop both visits; restore state from first visit's `stateSnapshot`
- **RNG:** rewind `botState.rngState` to value before the user's visit in that pair
- **`canUndo`:** `!botTurnActive && lastTwoVisitsAreUserThenDartBot(session)`

Existing `revertLastVisit()` unchanged for 1P and guest-only 2P.

### PlayerPanel

No structural change. DartBot panel shows live 3DA, last score, darts from `visitHistory`.

### Summary & API

- Reuse existing `FiveOhOneSummary` guest fields (`guestThreeDartAverage`, `guestDartsThrown`, `guestCheckouts`)
- `buildSummary()`: resolve **non-user player** (`guest` or `dartbot`) for opponent stats — same code path as today
- `Summary.astro`: label uses opponent `name` from settings ("DartBot" or guest name)
- `POST /api/games/501/complete` — persists **user stats only** via existing `applyGameCompletionToStats()`
- `validateCompletedFiveOhOneSession()`: must accept `dartbot` in settings replay; **`botState` ignored** during replay (stripped or optional on completed sessions)

---

## 7. Error handling

| Case                              | Behavior                                                                 |
| --------------------------------- | ------------------------------------------------------------------------ |
| Simulation returns invalid visit  | Fallback: score-0 visit; log error                                       |
| Tab backgrounded during animation | Pause animation; resume on focus                                         |
| Session resume mid-bot-turn       | Re-simulate from `botState.rngState` before animation; replay same darts |
| User undo (dartbot opponent)      | `revertLastOpponentPair()` — removes user + bot visit atomically         |
| Undo during bot simulation        | Not possible — `botTurnActive` locks controls                            |
| Missing checkout route            | Use `GeneratedCheckoutKnowledge` fallback                                |

---

## 8. Design constraints

### Allowed

- Setup shots
- Realistic misses and busts
- Route imperfections at low levels
- Per-leg variance in match plan
- Skippable animation

### Forbidden

- Score generation without dart simulation
- Forced checkout success
- Rubber-banding / mid-leg correction
- Artificial averages injected mid-match
- DartBot stats in database
- Server-side bot simulation

---

## 9. Testing strategy

### Unit tests (`dartbot/`)

- Level interpolation between anchors
- `MatchPlanner` leg distribution and average convergence
- `CheckoutPolicy` discipline spread at levels 1 vs 15
- `ThrowEngine` + `MissResolver` with seeded RNG
- `GeneratedCheckoutKnowledge` fallback coverage
- Full visit simulation: scoring visit, checkout visit, bust visit

### Integration tests (`501/`)

- Session factory creates `botState` for dartbot opponent
- `validateFiveOhOneSettings` accepts dartbot player + level bounds
- `validateCompletedFiveOhOneSession` replays dartbot 2P sessions (botState ignored)
- Play orchestration: user visit → bot visit applied to state
- `revertLastOpponentPair`: removes user+bot visits; RNG rewound
- `canUndo` false while `botTurnActive`
- Deterministic replay from stored seed
- Bot-starts-first: `maybePlayBotTurn` after 500ms delay

### Out of scope for v1

- E2E browser tests for modal animation
- Statistical distribution tests across large sample sizes (optional future benchmark script)

---

## 10. Future extensions (excluded)

- Pressure model
- Player personalities
- Fatigue / throw tempo
- Advanced board geometry
- Machine-learned route selection
- DartBot in game modes other than 501
- Server-side simulation

---

## 11. File change summary

| Action | Path                                                        |
| ------ | ----------------------------------------------------------- |
| Create | `app/src/lib/shared/dartbot/**`                             |
| Create | `app/src/lib/shared/dartbot/checkout/checkout-routes.json`  |
| Create | `app/src/components/games/501/OpponentPickerModal.astro`    |
| Create | `app/src/components/games/501/DartBotLevelSlider.astro`     |
| Create | `app/src/components/games/501/DartBotTurnModal.astro`       |
| Create | `app/src/components/games/501/Dartboard.astro`              |
| Modify | `app/src/lib/shared/games/501/settings.ts`                  |
| Modify | `app/src/lib/shared/games/501/session.ts`                   |
| Modify | `app/src/lib/shared/games/501/session-factory.ts`           |
| Modify | `app/src/lib/shared/games/501/validation.ts`                |
| Modify | `app/src/lib/shared/games/501/state.ts` (revertLastOpponentPair) |
| Modify | `app/src/lib/shared/games/501/summary.ts` (non-user opponent lookup) |
| Modify | `app/src/lib/shared/games/501/completion.ts` (dartbot settings replay) |
| Modify | `app/src/components/games/501/Summary.astro` |
| Modify | `app/src/lib/client/alpine/games/501.play.ts`               |
| Modify | `app/src/lib/client/alpine/games/501.settings.ts`           |
| Modify | `app/src/components/games/501/PlayerPicker.astro`           |
| Modify | `app/src/components/games/501/SettingsForm.astro`           |
| Modify | `app/src/components/games/501/Play.astro`                   |
| Create | `tests/lib/shared/dartbot/**`                               |
| Modify | `tests/lib/shared/games/501/**` (session, validation, play) |
