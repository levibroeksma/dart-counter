# Ten Up One Down — Simplified Tracking Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-15  
**Branch:** TBD  
**Scope:** Replace multi-step round-entry wizard with number-input pad + conditional confirmation modal; simplify round records and player stats to aggregate double-hit percentage only

**UI reference:** `app/src/components/games/ten-up-one-down/Play.astro` (numpad + modal prototype)

**Supersedes (play flow only):** Round-entry wizard sections in `docs/superpowers/specs/2026-06-14-ten-up-one-down-settings-design.md` — settings, session model, target rules, and undo remain unchanged unless noted below.

---

## 1. Overview

Simplify Ten Up One Down round tracking to **aggregate double-hit percentage** only. Remove per-double selection, bust prompts, and the multi-step inline wizard.

**New play flow:**

1. Player sees current target (unchanged).
2. Player enters a score via reusable **number input pad** (or leaves empty).
3. On submit, outcome is derived from input vs target.
4. A **confirmation modal** asks 0–2 follow-up questions (dart counts), then submits the round.

| Item | Value |
|------|-------|
| Stack | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript |
| Constraint source | Precomputed lookup table (`checkout-constraints.data.ts`) built by a checkout solver |
| Stats | Aggregate `{ doubleAttempts, doubleHits }` — drop per-double breakdown |
| Reusable UI | `NumberInputPad`, `OptionModal`, existing `DartCountPicker` |

---

## 2. Outcome resolution

On number-pad submit, before showing the modal:

| Input | Outcome |
|-------|---------|
| `null` / empty | **Failure** |
| Number ≠ `session.state.currentTarget` | **Failure** |
| Number === `session.state.currentTarget` | **Success** |

- The entered number is **not** stored on the round record (only used to detect success).
- Wrong-number failures do not record what was entered.
- Game target adjustment rules are unchanged (+10 success, −1 failure, bogey snap).

---

## 3. Confirmation modal

Generic `OptionModal` overlay. Questions are driven by outcome and checkout constraints. A single **Submit** button at the bottom commits the round (disabled until all visible pickers have a value).

### 3.1 Success path

Uses `getCheckoutConstraints(currentTarget)` from the precomputed table.

**Darts for finish** (`dartsForFinish`):

| Condition | UI | Auto value |
|-----------|-----|------------|
| `minFinish === maxFinish` | Skip question | that value |
| `minFinish === 2`, `maxFinish === 3` | Show [2, 3] | — |
| `minFinish === 1` | Show [1, 2, 3] | — |

**Darts on double** (`dartsOnDouble`):

| Condition | UI | Auto value |
|-----------|-----|------------|
| `minFinish === 3` (forced 3-dart checkout, e.g. 161, 170) | Skip question | `1` |
| `minFinish === 1` (pure double finishes: 2, 4, …, 40) | Show [1, 2, 3] | — |
| `minFinish >= 2` (setup required before double) | Show [1, 2] | — |

**Examples:**

| Target | Darts for finish | Darts on double |
|--------|------------------|-----------------|
| 41 | [2, 3] | [1, 2] |
| 40 | [1, 2, 3] | [1, 2, 3] |
| 170 | auto `3` | auto `1` |
| 161 | auto `3` | auto `1` |

When both questions are skipped (e.g. 170), modal shows **Submit only**.

### 3.2 Failure path

Always show two pickers (no constraint lookup):

| Question | Options |
|----------|---------|
| Darts on double | [0, 1, 2, 3] |
| Darts used | [1, 2, 3] |

Applies to both empty submit and wrong-number submit.

### 3.3 Cross-validation

Enforced on client (disable Submit) and server (`validateRoundRecord`):

| Outcome | Rules |
|---------|-------|
| Success | `dartsOnDouble` ∈ [1, 3]; `dartsForFinish` ∈ [1, 3]; `dartsOnDouble <= dartsForFinish`; `dartsUsed === dartsForFinish` |
| Failure | `dartsOnDouble` ∈ [0, 3]; `dartsUsed` ∈ [1, 3]; `dartsOnDouble <= dartsUsed` |

On success, `dartsUsed` is derived from `dartsForFinish` (not a separate question).

---

## 4. Checkout constraints (precomputed table)

### Approach

**Recommended:** one-time checkout solver generates `checkout-constraints.data.ts` mapping each finishable score 2–170 to `{ minFinish, maxFinish }`. Runtime function `getCheckoutConstraints(target)` reads the table and derives UI options per §3.1.

**Rejected:**

- Runtime BFS on every modal open — unnecessary complexity for a fixed ruleset.
- Deriving from `CHECKOUT_HINTS` segment count — single-route, misses alternatives (e.g. 41 via `1, D20`), and inherits bad hint data (e.g. `48: ["T16"]`).

### Solver rules

- Standard double-out: last dart must land on a double (including bull for 50).
- Visit length: 1–3 darts.
- `minFinish`: shortest checkout route length for the score.
- `maxFinish`: longest checkout route length within 3 darts (typically `3`; may be `2` when no 3-dart route exists).
- Bogey scores (169, 168, 166, 165, 163, 162, 159): excluded from table; `getCheckoutConstraints` returns `null`.
- Unfinishable scores (e.g. 1, odd < 40): excluded; return `null`.

### Files

| File | Role |
|------|------|
| `app/src/lib/shared/darts/checkout-solver.ts` | Solver used by codegen/tests to produce the table |
| `app/src/lib/shared/darts/checkout-constraints.data.ts` | Generated `Record<number, { minFinish, maxFinish }>` |
| `app/src/lib/shared/darts/checkout-constraints.ts` | `getCheckoutConstraints(target)` → modal option config |
| `app/tests/lib/shared/darts/checkout-constraints.test.ts` | Table spot-checks for 41, 40, 170, 161, bogeys |

---

## 5. Data model changes

### 5.1 Round record (simplified)

```ts
type TenUpOneDownRoundRecord = {
  roundNumber: number;
  targetAtStart: number;
  targetAfter: number;
  finished: boolean;
  dartsUsed: 1 | 2 | 3;
  dartsOnDouble: 0 | 1 | 2 | 3;
};
```

**Removed from round record:**

- `doubleAttempts: DoubleAttempt[]`
- `busted?: boolean`
- `WizardInput` union
- `deriveSuccessAttempts` / `deriveFailureAttempts` (per-double derivation)
- `finishedOnDouble`, `doubleAttempted` wizard fields

### 5.2 Player stats (aggregate)

```ts
type PlayerDartStats = {
  doubleAttempts: number;
  doubleHits: number;
  totalCheckouts: number;
  totalCheckoutDarts: number;
};
```

**Removed:** `doubleStats: Record<DoubleTarget, { attempts, successes }>`.

**`applyRoundToStats` logic:**

| Outcome | `doubleAttempts` | `doubleHits` | `totalCheckouts` | `totalCheckoutDarts` |
|---------|------------------|--------------|------------------|----------------------|
| Success | `+dartsOnDouble` | `+1` | `+1` | `+dartsUsed` |
| Failure | `+dartsOnDouble` | `+0` | — | — |

`revertRoundFromStats` (undo) reverses the same deltas.

**Migration:** reset existing per-double stats blobs to the new shape (game is early; no migration script required).

### 5.3 `buildRoundRecord`

```ts
function buildRoundRecord(
  roundNumber: number,
  targetAtStart: number,
  input:
    | { outcome: "success"; dartsForFinish: 1 | 2 | 3; dartsOnDouble: 1 | 2 | 3 }
    | { outcome: "failure"; dartsUsed: 1 | 2 | 3; dartsOnDouble: 0 | 1 | 2 | 3 }
): TenUpOneDownRoundRecord;
```

---

## 6. Components

### New (reusable)

| File | Role |
|------|------|
| `app/src/components/ui/NumberInputPad.astro` | Display string, 3×4 numpad, backspace, submit button. Game-agnostic; Alpine `model` + `@submit` |
| `app/src/components/ui/OptionModal.astro` | Overlay backdrop + card; slot or Alpine-driven question sections; footer Submit button |

### Reused

| File | Role |
|------|------|
| `app/src/components/games/ten-up-one-down/DartCountPicker.astro` | Option buttons for each modal question |
| `app/src/components/games/ten-up-one-down/TargetCard.astro` | Current target display |
| `app/src/components/games/ten-up-one-down/RoundProgress.astro` | Round / timer progress |

### Refactored

| File | Role |
|------|------|
| `app/src/components/games/ten-up-one-down/Play.astro` | Wire `NumberInputPad` + `OptionModal`; remove inline prototype markup |
| `app/src/lib/client/alpine/games/ten-up-one-down.play.ts` | Score → outcome → modal config → submit/undo API |

### Removed from play flow (files may be deleted or left unused)

| File | Reason |
|------|--------|
| `RoundEntryWizard.astro` | Replaced by pad + modal |
| `DoubleGrid.astro` | No per-double selection |

---

## 7. Alpine play state

```ts
// Key fields in tenUpOneDownPlay()
score: string | null;
showModal: boolean;
outcome: "success" | "failure" | null;
dartsOnDouble: number | null;
dartsForFinish: number | null;  // success only
dartsUsed: number | null;        // failure only
modalQuestions: ModalQuestion[]; // derived, drives OptionModal

submitScore()    // resolve outcome, build modalQuestions, open modal
modalSubmit()    // validate, buildRoundRecord, POST API
closeModal()     // reset modal state
```

`modalQuestions` entries:

```ts
type ModalQuestion = {
  id: "dartsOnDouble" | "dartsForFinish" | "dartsUsed";
  label: string;
  options: number[];
  autoValue?: number; // when set, picker hidden; value applied on open
};
```

---

## 8. Architecture

```
┌─────────────────────────────────────────┐
│ Play.astro                              │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ TargetCard  │  │ RoundProgress    │  │
│  └─────────────┘  └──────────────────┘  │
│  ┌─────────────────────────────────────┐│
│  │ NumberInputPad (reusable)           ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ OptionModal (reusable)              ││
│  │  DartCountPicker × 0–2              ││
│  │  Submit                             ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
         │
         ▼
tenUpOneDownPlay() ──► getCheckoutConstraints(target)
         │
         ▼
buildRoundRecord() ──► POST /api/games/ten-up-one-down/session/round
         │
         ▼
applyRoundToStats() / applyRoundToState()
```

**Separation of concerns:**

| Layer | Owns |
|-------|------|
| `NumberInputPad` | Input UX only |
| `OptionModal` + `DartCountPicker` | Question rendering |
| `checkout-constraints.ts` | Dart-option rules per target |
| `tenUpOneDownPlay` | Outcome logic, modal config, API calls |
| `round.ts` | Record building + validation |
| `double-stats.ts` | Aggregate stat updates |

---

## 9. Edge cases

| Case | Handling |
|------|----------|
| Empty submit | Failure modal (0–3 on double, 1–3 used) |
| Wrong number | Failure modal (same) |
| `dartsOnDouble > dartsUsed` (failure) | Submit disabled |
| `dartsOnDouble > dartsForFinish` (success) | Submit disabled |
| Forced 3-dart checkout (170, 161) | Both questions auto-filled; submit-only modal |
| Bogey target | Should not occur (engine snaps); `getCheckoutConstraints` returns `null` — guard in play code |
| Undo | Revert aggregate stats; restore previous target/round |
| Paused timed game | Disable pad submit (existing `controlsDisabled`) |
| Score > 180 or non-numeric | Reject on pad (no submit) |

---

## 10. Testing

| Area | Key cases |
|------|-----------|
| `checkout-constraints` | 41 → min 2 max 3; 40 → min 1 max 3; 170/161 → min 3 max 3; bogeys → null |
| Outcome resolution | null → failure; 40 on 41 → failure; 41 on 41 → success |
| `buildRoundRecord` | success/failure shapes; validation rejects invalid combos |
| `validateRoundRecord` | `dartsOnDouble` bounds; cross-field rules |
| `double-stats` | success +2 onDouble → attempts +2 hits +1; failure +2 → attempts +2 hits +0; undo |
| API round POST | accepts new record shape; rejects stale validation |

---

## 11. Out of scope

- Screen carousel wizard (`2026-06-15-screen-carousel-wizard-design.md`) — not used in this flow; modal replaces branching wizard
- Per-double stats display UI (no breakdown to show)
- Remembering entered wrong scores
- Bust flag on round record

---

## 12. Decisions log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Outcome detection | Empty or mismatch = fail; exact target = success | Minimal input; target always visible |
| Failure modal | Darts on double [0–3] + darts used [1–3] | Still track double attempts on misses |
| Stats shape | Aggregate only | User wants double hit % only |
| Constraint source | Precomputed table | Correct multi-route analysis; fast; testable |
| Success `dartsUsed` | Derived from `dartsForFinish` | Avoid redundant question |
