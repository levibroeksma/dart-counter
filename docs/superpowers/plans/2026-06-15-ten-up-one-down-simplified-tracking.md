# Ten Up One Down Simplified Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task subagent requirements (all mandatory):**
> 1. **test-driven-development** — for any task that writes or changes code
> 2. **verification-before-completion** — run the full verification gate (below) immediately before marking the task done or committing; no completion claims without fresh command output
>
> A task is **not complete** until its verification gate step passes with evidence recorded in the subagent's final report.

**Goal:** Replace the multi-step round-entry wizard with a number-input pad + conditional confirmation modal; simplify round records and player stats to aggregate double-hit percentage only.

**Architecture:** Precomputed checkout-constraints table drives success-modal questions. `NumberInputPad` captures score → outcome derived vs target → `OptionModal` collects 0–2 dart-count answers → `buildRoundRecord` posts to existing session API. Settings, session model, target rules, and undo stay unchanged.

**Tech Stack:** Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript, Vitest, jsdom, curl (client smoke)

**Branch:** TBD  
**Spec:** `docs/superpowers/specs/2026-06-15-ten-up-one-down-simplified-tracking-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

---

## Verification Gate (every task)

**Iron law:** No completion claims without fresh verification evidence from this session.

### 1. Static analysis (strict)

```bash
npm run check
```

**Required output tail (all three must be 0):**

```
Result (N files):
- 0 errors
- 0 warnings
- 0 hints
```

If any count is non-zero: fix, re-run `npm run check`, repeat until 0/0/0.

### 2. Unit / integration tests

```bash
npm test
```

Required: exit code 0, 0 failures.

### 3. Production build

```bash
npm run build
```

Required: exit code 0.

### 4. Curl smoke (UI-facing tasks: 6–10 and final cleanup)

UI tasks must verify SSR HTML and API wiring via curl — not only Vitest/jsdom.

**Prerequisites:** Dev server running (`npm run dev` in background, default `http://localhost:4321`). Credentials from `app/.env` (or vitest defaults: `testuser` / `testpass`).

```bash
# scripts/curl-verify-tuod.sh — created in Task 6, extended per task
./scripts/curl-verify-tuod.sh
```

Subagents must paste full script output (pass/fail per assertion) in their final report.

### Dispatcher handoff prompt

```
REQUIRED SUB-SKILLS: test-driven-development (code tasks), verification-before-completion (always).
Before reporting task complete: run the Verification Gate in the plan.
npm run check MUST show 0 errors, 0 warnings, 0 hints.
UI tasks MUST run ./scripts/curl-verify-tuod.sh with dev server up.
Include fresh command output as evidence. Do not claim success without it.
```

---

## File Structure Overview

| File | Responsibility |
|---|---|
| `src/lib/shared/darts/checkout-solver.ts` | BFS solver; used by codegen + tests |
| `src/lib/shared/darts/checkout-constraints.data.ts` | Generated `Record<number, { minFinish, maxFinish }>` |
| `src/lib/shared/darts/checkout-constraints.ts` | `getCheckoutConstraints()`, `buildSuccessModalQuestions()` |
| `src/lib/shared/games/ten-up-one-down/round.ts` | Simplified record, `buildRoundRecord`, `validateRoundRecord` |
| `src/lib/shared/stats/types.ts` | Aggregate `PlayerDartStats` |
| `src/lib/shared/stats/double-stats.ts` | `applyRoundToStats` / `revertRoundFromStats` (aggregate) |
| `src/components/ui/NumberInputPad.astro` | Reusable numpad + display + submit |
| `src/components/ui/OptionModal.astro` | Reusable overlay + footer submit |
| `src/components/games/ten-up-one-down/Play.astro` | Wire pad + modal + session |
| `src/lib/client/alpine/games/ten-up-one-down.play.ts` | Score → outcome → modal → API |
| `scripts/curl-verify-tuod.sh` | Curl smoke for play page + API |
| `tests/lib/shared/darts/checkout-solver.test.ts` | Solver spot-checks |
| `tests/lib/shared/darts/checkout-constraints.test.ts` | Table + modal question config |
| `tests/lib/shared/games/ten-up-one-down/round.test.ts` | Rewritten for new record shape |
| `tests/lib/shared/stats/double-stats.test.ts` | Rewritten for aggregate stats |
| `tests/lib/client/alpine/games/ten-up-one-down.play.test.ts` | Rewritten for pad/modal flow |

**Deleted in Task 11:**

| File | Reason |
|---|---|
| `src/components/games/ten-up-one-down/RoundEntryWizard.astro` | Replaced by pad + modal |
| `src/components/games/ten-up-one-down/DoubleGrid.astro` | No per-double selection |

---

### Task 1: Checkout Solver

**Files:**
- Create: `app/src/lib/shared/darts/checkout-solver.ts`
- Test: `app/tests/lib/shared/darts/checkout-solver.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/darts/checkout-solver.test.ts
import { describe, it, expect } from "vitest";
import { solveCheckoutConstraints } from "@lib/shared/darts/checkout-solver";

describe("solveCheckoutConstraints", () => {
  it("returns min/max finish dart counts for finishable scores", () => {
    expect(solveCheckoutConstraints(40)).toEqual({ minFinish: 1, maxFinish: 3 });
    expect(solveCheckoutConstraints(41)).toEqual({ minFinish: 2, maxFinish: 3 });
    expect(solveCheckoutConstraints(170)).toEqual({ minFinish: 3, maxFinish: 3 });
    expect(solveCheckoutConstraints(161)).toEqual({ minFinish: 3, maxFinish: 3 });
  });

  it("returns null for bogeys and unfinishable scores", () => {
    expect(solveCheckoutConstraints(169)).toBeNull();
    expect(solveCheckoutConstraints(1)).toBeNull();
    expect(solveCheckoutConstraints(171)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/darts/checkout-solver.test.ts`
Expected: FAIL — `solveCheckoutConstraints` not defined

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/darts/checkout-solver.ts
import { isBogey } from "@lib/shared/darts/bogeys";

export type CheckoutConstraint = { minFinish: number; maxFinish: number };

const SINGLES = Array.from({ length: 20 }, (_, i) => i + 1);
const DOUBLES = Array.from({ length: 20 }, (_, i) => (i + 1) * 2);
const TRIPLES = Array.from({ length: 20 }, (_, i) => (i + 1) * 3);

function scoresForDart(isFinishingDart: boolean): number[] {
  if (isFinishingDart) return [...DOUBLES, 50];
  return [...SINGLES, ...DOUBLES, ...TRIPLES, 25, 50];
}

function canCheckout(remaining: number, dartsLeft: number): boolean {
  if (remaining < 0 || remaining === 1) return false;
  if (remaining === 0) return true;
  if (dartsLeft === 0) return false;

  for (const score of scoresForDart(dartsLeft === 1)) {
    if (canCheckout(remaining - score, dartsLeft - 1)) return true;
  }
  return false;
}

function minDartsToCheckout(remaining: number): number | null {
  for (let darts = 1; darts <= 3; darts++) {
    if (canCheckout(remaining, darts)) return darts;
  }
  return null;
}

function maxDartsToCheckout(remaining: number): number | null {
  for (let darts = 3; darts >= 1; darts--) {
    if (canCheckout(remaining, darts)) return darts;
  }
  return null;
}

/**
 * Compute shortest and longest checkout visit lengths (1–3 darts) for a finishable score.
 */
export function solveCheckoutConstraints(target: number): CheckoutConstraint | null {
  if (target < 2 || target > 170 || target % 2 === 1 && target < 40) return null;
  if (isBogey(target)) return null;

  const minFinish = minDartsToCheckout(target);
  const maxFinish = maxDartsToCheckout(target);
  if (minFinish === null || maxFinish === null) return null;

  return { minFinish, maxFinish };
}

/**
 * Build the full constraints table for scores 2–170.
 */
export function buildCheckoutConstraintsTable(): Record<number, CheckoutConstraint> {
  const table: Record<number, CheckoutConstraint> = {};
  for (let score = 2; score <= 170; score++) {
    const constraint = solveCheckoutConstraints(score);
    if (constraint) table[score] = constraint;
  }
  return table;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/darts/checkout-solver.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Verification gate**

```bash
cd app && npm run check && npm test && npm run build
```

Record output. `npm run check` must be 0 errors / 0 warnings / 0 hints.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/shared/darts/checkout-solver.ts app/tests/lib/shared/darts/checkout-solver.test.ts
git commit -m "feat: add checkout solver for constraint table generation"
```

---

### Task 2: Checkout Constraints Data + Runtime

**Files:**
- Create: `app/src/lib/shared/darts/checkout-constraints.data.ts`
- Create: `app/src/lib/shared/darts/checkout-constraints.ts`
- Test: `app/tests/lib/shared/darts/checkout-constraints.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/darts/checkout-constraints.test.ts
import { describe, it, expect } from "vitest";
import {
  getCheckoutConstraints,
  buildSuccessModalQuestions,
} from "@lib/shared/darts/checkout-constraints";

describe("getCheckoutConstraints", () => {
  it("returns table entries for known targets", () => {
    expect(getCheckoutConstraints(41)).toEqual({ minFinish: 2, maxFinish: 3 });
    expect(getCheckoutConstraints(40)).toEqual({ minFinish: 1, maxFinish: 3 });
    expect(getCheckoutConstraints(170)).toEqual({ minFinish: 3, maxFinish: 3 });
    expect(getCheckoutConstraints(161)).toEqual({ minFinish: 3, maxFinish: 3 });
  });

  it("returns null for bogeys", () => {
    expect(getCheckoutConstraints(169)).toBeNull();
  });
});

describe("buildSuccessModalQuestions", () => {
  it("41 shows darts for finish [2,3] and darts on double [1,2]", () => {
    const questions = buildSuccessModalQuestions(41);
    expect(questions).toEqual([
      { id: "dartsForFinish", label: "Darts for finish", options: [2, 3] },
      { id: "dartsOnDouble", label: "Darts on double", options: [1, 2] },
    ]);
  });

  it("40 shows both pickers with full ranges", () => {
    const questions = buildSuccessModalQuestions(40);
    expect(questions).toEqual([
      { id: "dartsForFinish", label: "Darts for finish", options: [1, 2, 3] },
      { id: "dartsOnDouble", label: "Darts on double", options: [1, 2, 3] },
    ]);
  });

  it("170 auto-fills both values (submit-only modal)", () => {
    const questions = buildSuccessModalQuestions(170);
    expect(questions).toEqual([
      { id: "dartsForFinish", label: "Darts for finish", options: [3], autoValue: 3 },
      { id: "dartsOnDouble", label: "Darts on double", options: [1], autoValue: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/darts/checkout-constraints.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Generate data file and write runtime module**

Generate `checkout-constraints.data.ts` once (can be a small script or inline in test setup):

```typescript
// app/src/lib/shared/darts/checkout-constraints.data.ts
// Generated by buildCheckoutConstraintsTable() — do not edit manually.
import type { CheckoutConstraint } from "@lib/shared/darts/checkout-solver";

export const CHECKOUT_CONSTRAINTS: Record<number, CheckoutConstraint> = {
  // Run: node -e "import('./src/lib/shared/darts/checkout-solver.ts').then(m => console.log(JSON.stringify(m.buildCheckoutConstraintsTable())))"
  // Paste output here, OR commit a generated file from the solver in this task.
};
```

**Implementer note:** In this step, run the solver and write the full JSON map to `checkout-constraints.data.ts`. The file will be large (~100 entries) — that is expected.

```typescript
// app/src/lib/shared/darts/checkout-constraints.ts
import { CHECKOUT_CONSTRAINTS } from "@lib/shared/darts/checkout-constraints.data";
import type { CheckoutConstraint } from "@lib/shared/darts/checkout-solver";

export type ModalQuestion = {
  id: "dartsOnDouble" | "dartsForFinish" | "dartsUsed";
  label: string;
  options: number[];
  autoValue?: number;
};

export function getCheckoutConstraints(target: number): CheckoutConstraint | null {
  return CHECKOUT_CONSTRAINTS[target] ?? null;
}

function dartsForFinishQuestion(c: CheckoutConstraint): ModalQuestion {
  if (c.minFinish === c.maxFinish) {
    return {
      id: "dartsForFinish",
      label: "Darts for finish",
      options: [c.minFinish],
      autoValue: c.minFinish,
    };
  }
  if (c.minFinish === 2 && c.maxFinish === 3) {
    return { id: "dartsForFinish", label: "Darts for finish", options: [2, 3] };
  }
  return { id: "dartsForFinish", label: "Darts for finish", options: [1, 2, 3] };
}

function dartsOnDoubleQuestion(c: CheckoutConstraint): ModalQuestion {
  if (c.minFinish === 3) {
    return {
      id: "dartsOnDouble",
      label: "Darts on double",
      options: [1],
      autoValue: 1,
    };
  }
  if (c.minFinish === 1) {
    return { id: "dartsOnDouble", label: "Darts on double", options: [1, 2, 3] };
  }
  return { id: "dartsOnDouble", label: "Darts on double", options: [1, 2] };
}

export function buildSuccessModalQuestions(target: number): ModalQuestion[] {
  const c = getCheckoutConstraints(target);
  if (!c) return [];
  return [dartsForFinishQuestion(c), dartsOnDoubleQuestion(c)];
}

export function buildFailureModalQuestions(): ModalQuestion[] {
  return [
    { id: "dartsOnDouble", label: "Darts on double", options: [0, 1, 2, 3] },
    { id: "dartsUsed", label: "Darts used", options: [1, 2, 3] },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/darts/checkout-constraints.test.ts`
Expected: PASS

- [ ] **Step 5: Verification gate**

```bash
cd app && npm run check && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/shared/darts/checkout-constraints.data.ts app/src/lib/shared/darts/checkout-constraints.ts app/tests/lib/shared/darts/checkout-constraints.test.ts
git commit -m "feat: add precomputed checkout constraints and modal question builder"
```

---

### Task 3: Simplify Round Record Model

**Files:**
- Modify: `app/src/lib/shared/games/ten-up-one-down/round.ts` (full rewrite)
- Modify: `app/tests/lib/shared/games/ten-up-one-down/round.test.ts` (full rewrite)

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/ten-up-one-down/round.test.ts
import { describe, it, expect } from "vitest";
import { buildRoundRecord, validateRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

describe("buildRoundRecord", () => {
  it("builds success record with derived dartsUsed", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "success",
      dartsForFinish: 2,
      dartsOnDouble: 1,
    });
    expect(record).toEqual({
      roundNumber: 1,
      targetAtStart: 41,
      targetAfter: 41,
      finished: true,
      dartsUsed: 2,
      dartsOnDouble: 1,
    });
  });

  it("builds failure record", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "failure",
      dartsUsed: 3,
      dartsOnDouble: 2,
    });
    expect(record).toEqual({
      roundNumber: 1,
      targetAtStart: 41,
      targetAfter: 41,
      finished: false,
      dartsUsed: 3,
      dartsOnDouble: 2,
    });
  });
});

describe("validateRoundRecord", () => {
  it("rejects success when dartsOnDouble > dartsUsed", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "success",
      dartsForFinish: 2,
      dartsOnDouble: 3,
    });
    expect(validateRoundRecord(record).valid).toBe(false);
  });

  it("rejects failure when dartsOnDouble > dartsUsed", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "failure",
      dartsUsed: 2,
      dartsOnDouble: 3,
    });
    expect(validateRoundRecord(record).valid).toBe(false);
  });

  it("accepts valid success and failure records", () => {
    expect(
      validateRoundRecord(
        buildRoundRecord(1, 40, { outcome: "success", dartsForFinish: 1, dartsOnDouble: 1 }),
      ).valid,
    ).toBe(true);
    expect(
      validateRoundRecord(
        buildRoundRecord(1, 40, { outcome: "failure", dartsUsed: 3, dartsOnDouble: 0 }),
      ).valid,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/round.test.ts`
Expected: FAIL — old `buildRoundRecord` signature / missing `dartsOnDouble` on record

- [ ] **Step 3: Rewrite round.ts**

```typescript
// app/src/lib/shared/games/ten-up-one-down/round.ts
import { MessageCode } from "@lib/shared/constants/errors.constants";

export type TenUpOneDownRoundRecord = {
  roundNumber: number;
  targetAtStart: number;
  targetAfter: number;
  finished: boolean;
  dartsUsed: 1 | 2 | 3;
  dartsOnDouble: 0 | 1 | 2 | 3;
};

export type RoundInput =
  | { outcome: "success"; dartsForFinish: 1 | 2 | 3; dartsOnDouble: 1 | 2 | 3 }
  | { outcome: "failure"; dartsUsed: 1 | 2 | 3; dartsOnDouble: 0 | 1 | 2 | 3 };

export function buildRoundRecord(
  roundNumber: number,
  targetAtStart: number,
  input: RoundInput,
): TenUpOneDownRoundRecord {
  if (input.outcome === "success") {
    return {
      roundNumber,
      targetAtStart,
      targetAfter: targetAtStart,
      finished: true,
      dartsUsed: input.dartsForFinish,
      dartsOnDouble: input.dartsOnDouble,
    };
  }
  return {
    roundNumber,
    targetAtStart,
    targetAfter: targetAtStart,
    finished: false,
    dartsUsed: input.dartsUsed,
    dartsOnDouble: input.dartsOnDouble,
  };
}

export type ValidateRoundResult =
  | { valid: true }
  | { valid: false; code: typeof MessageCode.INVALID_ROUND };

export function validateRoundRecord(record: TenUpOneDownRoundRecord): ValidateRoundResult {
  if (record.finished) {
    if (record.dartsOnDouble < 1 || record.dartsOnDouble > 3) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }
    if (record.dartsUsed < 1 || record.dartsUsed > 3) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }
    if (record.dartsOnDouble > record.dartsUsed) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }
    return { valid: true };
  }

  if (record.dartsOnDouble < 0 || record.dartsOnDouble > 3) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  if (record.dartsUsed < 1 || record.dartsUsed > 3) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  if (record.dartsOnDouble > record.dartsUsed) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  return { valid: true };
}
```

- [ ] **Step 4: Fix downstream compile errors**

Update test fixtures in files that still reference `doubleAttempts` (will fail `npm run check`):
- `app/tests/api/games/ten-up-one-down/round.test.ts` — change `validRound` to new shape
- `app/tests/api/games/ten-up-one-down/round-last.test.ts` — update round fixtures
- `app/tests/lib/shared/games/ten-up-one-down/state.test.ts` — update round fixtures if needed

Example `validRound`:

```typescript
const validRound = {
  roundNumber: 1,
  targetAtStart: 41,
  targetAfter: 41,
  finished: true,
  dartsUsed: 2,
  dartsOnDouble: 1,
};
```

In `round.test.ts` API test, update invalid-round case:

```typescript
it("rejects invalid round payload", async () => {
  const response = await POST(
    createContext({ ...validRound, dartsOnDouble: 3, dartsUsed: 2 })
  );
  // ...
});
```

- [ ] **Step 5: Run tests**

Run: `cd app && npm test`
Expected: failures only in stats/alpine tests (fixed in Task 4–5)

- [ ] **Step 6: Verification gate**

```bash
cd app && npm run check && npm test && npm run build
```

Fix any check hints from stale imports (`DoubleTarget`, `deriveSuccessAttempts`, etc.).

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/shared/games/ten-up-one-down/round.ts app/tests/lib/shared/games/ten-up-one-down/round.test.ts app/tests/api/games/ten-up-one-down/round.test.ts app/tests/api/games/ten-up-one-down/round-last.test.ts
git commit -m "refactor: simplify ten-up-one-down round record to aggregate dart counts"
```

---

### Task 4: Simplify Player Stats

**Files:**
- Modify: `app/src/lib/shared/stats/types.ts`
- Modify: `app/src/lib/shared/stats/double-stats.ts`
- Modify: `app/tests/lib/shared/stats/double-stats.test.ts`
- Modify: `app/tests/lib/server/data/player-dart-stats.test.ts`
- Modify: `app/tests/api/games/ten-up-one-down/round-last.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/stats/double-stats.test.ts
import { describe, it, expect } from "vitest";
import {
  createEmptyPlayerDartStats,
  applyRoundToStats,
  revertRoundFromStats,
} from "@lib/shared/stats/double-stats";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

const successRound: TenUpOneDownRoundRecord = {
  roundNumber: 1,
  targetAtStart: 41,
  targetAfter: 51,
  finished: true,
  dartsUsed: 2,
  dartsOnDouble: 2,
};

const failureRound: TenUpOneDownRoundRecord = {
  roundNumber: 2,
  targetAtStart: 51,
  targetAfter: 50,
  finished: false,
  dartsUsed: 3,
  dartsOnDouble: 2,
};

describe("double-stats", () => {
  it("applies success: +dartsOnDouble attempts, +1 hit, checkout totals", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, successRound);
    expect(stats.doubleAttempts).toBe(2);
    expect(stats.doubleHits).toBe(1);
    expect(stats.totalCheckouts).toBe(1);
    expect(stats.totalCheckoutDarts).toBe(2);
  });

  it("applies failure: +dartsOnDouble attempts, no hits or checkout totals", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, failureRound);
    expect(stats.doubleAttempts).toBe(2);
    expect(stats.doubleHits).toBe(0);
    expect(stats.totalCheckouts).toBe(0);
    expect(stats.totalCheckoutDarts).toBe(0);
  });

  it("reverts a previously applied round", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, successRound);
    revertRoundFromStats(stats, successRound);
    expect(stats).toEqual(createEmptyPlayerDartStats());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/stats/double-stats.test.ts`
Expected: FAIL — `doubleAttempts` property missing on stats

- [ ] **Step 3: Rewrite types and stats module**

```typescript
// app/src/lib/shared/stats/types.ts
export type PlayerDartStats = {
  doubleAttempts: number;
  doubleHits: number;
  totalCheckouts: number;
  totalCheckoutDarts: number;
};
```

```typescript
// app/src/lib/shared/stats/double-stats.ts
import type { PlayerDartStats } from "@lib/shared/stats/types";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

export function createEmptyPlayerDartStats(): PlayerDartStats {
  return {
    doubleAttempts: 0,
    doubleHits: 0,
    totalCheckouts: 0,
    totalCheckoutDarts: 0,
  };
}

export function applyRoundToStats(stats: PlayerDartStats, round: TenUpOneDownRoundRecord): void {
  stats.doubleAttempts += round.dartsOnDouble;
  if (round.finished) {
    stats.doubleHits += 1;
    stats.totalCheckouts += 1;
    stats.totalCheckoutDarts += round.dartsUsed;
  }
}

export function revertRoundFromStats(stats: PlayerDartStats, round: TenUpOneDownRoundRecord): void {
  stats.doubleAttempts -= round.dartsOnDouble;
  if (round.finished) {
    stats.doubleHits -= 1;
    stats.totalCheckouts -= 1;
    stats.totalCheckoutDarts -= round.dartsUsed;
  }
}
```

Update `player-dart-stats.test.ts`:

```typescript
expect(stats.doubleAttempts).toBe(0);
expect(stats.doubleHits).toBe(0);
// remove doubleStats.D1 assertions
```

Update `round-last.test.ts` stats seed:

```typescript
const stats = createEmptyPlayerDartStats();
stats.doubleAttempts = 1;
stats.doubleHits = 1;
```

- [ ] **Step 4: Run tests**

Run: `cd app && npm test`
Expected: Alpine play tests still fail (Task 8)

- [ ] **Step 5: Verification gate**

```bash
cd app && npm run check && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/shared/stats/types.ts app/src/lib/shared/stats/double-stats.ts app/tests/lib/shared/stats/double-stats.test.ts app/tests/lib/server/data/player-dart-stats.test.ts app/tests/api/games/ten-up-one-down/round-last.test.ts
git commit -m "refactor: aggregate player dart stats for double hit percentage"
```

---

### Task 5: Outcome Resolution Helper

**Files:**
- Create: `app/src/lib/shared/games/ten-up-one-down/outcome.ts`
- Test: `app/tests/lib/shared/games/ten-up-one-down/outcome.test.ts`

Pure function used by Alpine factory — keeps play.ts thin and testable.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { resolveRoundOutcome } from "@lib/shared/games/ten-up-one-down/outcome";

describe("resolveRoundOutcome", () => {
  it("empty score is failure", () => {
    expect(resolveRoundOutcome(null, 41)).toBe("failure");
    expect(resolveRoundOutcome("", 41)).toBe("failure");
  });

  it("wrong number is failure", () => {
    expect(resolveRoundOutcome("40", 41)).toBe("failure");
  });

  it("matching target is success", () => {
    expect(resolveRoundOutcome("41", 41)).toBe("success");
  });

  it("rejects invalid numeric input", () => {
    expect(resolveRoundOutcome("abc", 41)).toBeNull();
    expect(resolveRoundOutcome("181", 41)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/outcome.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// app/src/lib/shared/games/ten-up-one-down/outcome.ts
export type RoundOutcome = "success" | "failure";

export function resolveRoundOutcome(
  score: string | null,
  currentTarget: number,
): RoundOutcome | null {
  if (score === null || score === "") return "failure";
  if (!/^\d+$/.test(score)) return null;
  const value = Number(score);
  if (value > 180) return null;
  return value === currentTarget ? "success" : "failure";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/outcome.test.ts`
Expected: PASS

- [ ] **Step 5: Verification gate + commit**

```bash
cd app && npm run check && npm test && npm run build
git add app/src/lib/shared/games/ten-up-one-down/outcome.ts app/tests/lib/shared/games/ten-up-one-down/outcome.test.ts
git commit -m "feat: add score-to-outcome resolution for ten-up-one-down"
```

---

### Task 6: NumberInputPad + Curl Script Foundation

**Files:**
- Create: `app/src/components/ui/NumberInputPad.astro`
- Create: `app/scripts/curl-verify-tuod.sh`
- Modify: `app/src/components/games/ten-up-one-down/Play.astro` (temporary mount for curl verification)

- [ ] **Step 1: Create curl verification script**

```bash
#!/usr/bin/env bash
# app/scripts/curl-verify-tuod.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4321}"
USER="${AUTH_USERNAME:-testuser}"
PASS="${AUTH_PASSWORD:-testpass}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

login() {
  curl -sf -c "$JAR" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" > /dev/null
}

assert_contains() {
  local haystack="$1" needle="$2" label="$3"
  if ! printf '%s' "$haystack" | grep -q "$needle"; then
    echo "FAIL: $label — expected substring: $needle"
    exit 1
  fi
  echo "PASS: $label"
}

login
echo "Logged in"

SESSION_RESP=$(curl -sf -b "$JAR" -X POST "$BASE_URL/api/games/ten-up-one-down/session" \
  -H "Content-Type: application/json" \
  -d '{"endMode":"rounds","roundCount":10}')
assert_contains "$SESSION_RESP" '"ok":true' "session created"

HTML=$(curl -sf -b "$JAR" "$BASE_URL/games/ten-up-one-down")
assert_contains "$HTML" 'data-testid="tuod-number-pad"' "play page renders NumberInputPad"
assert_contains "$HTML" 'data-testid="tuod-score-display"' "play page renders score display"

echo "All curl checks passed"
```

```bash
chmod +x app/scripts/curl-verify-tuod.sh
```

- [ ] **Step 2: Create NumberInputPad component**

```astro
---
// app/src/components/ui/NumberInputPad.astro
import BackspaceIcon from "@icons/backspace.svg";

interface Props {
  scoreModel: string;
  submitAction: string;
  disabledExpr?: string;
  canUndoExpr?: string;
  undoAction?: string;
}

const {
  scoreModel,
  submitAction,
  disabledExpr = "false",
  canUndoExpr = "false",
  undoAction = "",
} = Astro.props;
---

<div data-testid="tuod-number-pad" class="flex flex-col flex-1">
  <div class="flex items-center h-fit border rounded-md border-white/20 bg-white/10">
    <span
      data-testid="tuod-score-display"
      class="text-xs font-bold flex-1 px-4 py-2"
      x-text={`${scoreModel} ? ${scoreModel} : 'Enter a score'`}
    ></span>
    <div class="rounded-r-full border-muted pl-4 pr-2 py-2">
      <button
        type="button"
        class="bg-accent rounded-md px-4 py-2 text-slate-900 text-xs"
        :disabled={disabledExpr}
        @click={submitAction}
      >
        Submit
      </button>
    </div>
  </div>

  <div class="grid grid-cols-3 grid-rows-4 mt-4 divide-x divide-white/10 flex-1">
    <!-- digits 1,4,7 + undo column; 2,5,8,0; 3,6,9,backspace -->
    <!-- mirror layout from Play.astro prototype; each digit: @click={`${scoreModel} = ...`} -->
  </div>
</div>
```

Implement all 12 numpad buttons matching the prototype in `Play.astro` (lines 85–110). Reject submit when `disabledExpr` is true (paused/loading).

- [ ] **Step 3: Temporarily wire into Play.astro for curl**

Import `NumberInputPad` and replace inline numpad markup. Keep prototype modal for now — curl only checks pad markers in this task.

- [ ] **Step 4: Start dev server and run curl**

```bash
cd app && npm run dev &
sleep 3
./scripts/curl-verify-tuod.sh
```

Expected: all PASS lines, exit 0

- [ ] **Step 5: Verification gate**

```bash
cd app && npm run check && npm test && npm run build
```

Must be 0 errors / 0 warnings / 0 hints.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/ui/NumberInputPad.astro app/scripts/curl-verify-tuod.sh app/src/components/games/ten-up-one-down/Play.astro
git commit -m "feat: add reusable NumberInputPad with curl smoke script"
```

---

### Task 7: OptionModal Component

**Files:**
- Create: `app/src/components/ui/OptionModal.astro`
- Modify: `app/scripts/curl-verify-tuod.sh` (add modal assertions)
- Modify: `app/src/components/games/ten-up-one-down/Play.astro` (swap inline modal)

- [ ] **Step 1: Create OptionModal**

```astro
---
// app/src/components/ui/OptionModal.astro
interface Props {
  openModel: string;
  submitAction: string;
  submitDisabledExpr: string;
  closeAction?: string;
}

const { openModel, submitAction, submitDisabledExpr, closeAction } = Astro.props;
---

<div
  data-testid="tuod-option-modal"
  class="absolute top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center z-10 p-4"
  x-show={openModel}
  x-cloak
  @keydown.escape.window={closeAction}
>
  <div class="card-interactive rounded-md p-4 w-full max-w-sm" @click.stop>
    <slot />
    <button
      type="button"
      class="btn-primary btn-press w-full mt-4"
      data-testid="tuod-modal-submit"
      :disabled={submitDisabledExpr}
      @click={submitAction}
    >
      Submit
    </button>
  </div>
</div>
```

- [ ] **Step 2: Replace inline modal in Play.astro**

Use `OptionModal` with `DartCountPicker` children driven by Alpine `modalQuestions` (placeholder static questions OK for this task; dynamic wiring in Task 9).

Add to curl script:

```bash
assert_contains "$HTML" 'data-testid="tuod-option-modal"' "play page renders OptionModal"
```

- [ ] **Step 3: Run curl smoke**

```bash
./scripts/curl-verify-tuod.sh
```

Expected: all PASS

- [ ] **Step 4: Verification gate**

```bash
cd app && npm run check && npm test && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add app/src/components/ui/OptionModal.astro app/scripts/curl-verify-tuod.sh app/src/components/games/ten-up-one-down/Play.astro
git commit -m "feat: add reusable OptionModal for round confirmation"
```

---

### Task 8: Refactor Alpine Play Factory

**Files:**
- Modify: `app/src/lib/client/alpine/games/ten-up-one-down.play.ts` (full rewrite)
- Modify: `app/tests/lib/client/alpine/games/ten-up-one-down.play.test.ts` (full rewrite)

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tenUpOneDownPlay } from "@lib/client/alpine/games/ten-up-one-down.play";

const roundsSession = {
  slug: "ten-up-one-down" as const,
  settings: { endMode: "rounds" as const, roundCount: 10 },
  state: { currentRound: 1, currentTarget: 41, status: "active" as const, lastAdjustment: null },
  roundHistory: [],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

describe("tenUpOneDownPlay", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "location", { value: { href: "" }, writable: true, configurable: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("submitScore opens failure modal for empty score", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.score = null;
    play.submitScore();
    expect(play.outcome).toBe("failure");
    expect(play.showModal).toBe(true);
    expect(play.modalQuestions.map((q) => q.id)).toEqual(["dartsOnDouble", "dartsUsed"]);
  });

  it("submitScore opens success modal for matching target", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.score = "41";
    play.submitScore();
    expect(play.outcome).toBe("success");
    expect(play.modalQuestions[0]?.id).toBe("dartsForFinish");
  });

  it("modalCanSubmit is false when dartsOnDouble > dartsUsed on failure", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.submitScore(); // empty → failure
    play.dartsOnDouble = 3;
    play.dartsUsed = 2;
    expect(play.modalCanSubmit).toBe(false);
  });

  it("modalSubmit posts simplified round record", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        session: {
          ...roundsSession,
          state: { ...roundsSession.state, currentRound: 2, currentTarget: 51 },
          roundHistory: [{ roundNumber: 1 }],
        },
      }),
    } as Response);

    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.score = "41";
    play.submitScore();
    play.dartsForFinish = 2;
    play.dartsOnDouble = 1;

    await play.modalSubmit();

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.round).toEqual(
      expect.objectContaining({
        roundNumber: 1,
        targetAtStart: 41,
        finished: true,
        dartsUsed: 2,
        dartsOnDouble: 1,
      }),
    );
    expect(play.showModal).toBe(false);
    expect(play.score).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`
Expected: FAIL

- [ ] **Step 3: Rewrite ten-up-one-down.play.ts**

Key implementation requirements:

```typescript
import { resolveRoundOutcome } from "@lib/shared/games/ten-up-one-down/outcome";
import {
  buildFailureModalQuestions,
  buildSuccessModalQuestions,
  type ModalQuestion,
} from "@lib/shared/darts/checkout-constraints";
import { buildRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

// State fields per spec §7:
// score, showModal, outcome, dartsOnDouble, dartsForFinish, dartsUsed, modalQuestions

submitScore() {
  const resolved = resolveRoundOutcome(this.score, this.session.state.currentTarget);
  if (resolved === null) return; // invalid pad input
  this.outcome = resolved;
  this.modalQuestions =
    resolved === "success"
      ? buildSuccessModalQuestions(this.session.state.currentTarget)
      : buildFailureModalQuestions();
  this.applyAutoValues();
  this.showModal = true;
},

applyAutoValues() {
  for (const q of this.modalQuestions) {
    if (q.autoValue !== undefined) this[q.id] = q.autoValue;
  }
},

get modalCanSubmit() {
  if (this.outcome === "success") {
    if (this.dartsForFinish === null || this.dartsOnDouble === null) return false;
    return this.dartsOnDouble <= this.dartsForFinish;
  }
  if (this.dartsUsed === null || this.dartsOnDouble === null) return false;
  return this.dartsOnDouble <= this.dartsUsed;
},

closeModal() {
  this.showModal = false;
  this.outcome = null;
  this.dartsOnDouble = null;
  this.dartsForFinish = null;
  this.dartsUsed = null;
  this.modalQuestions = [];
},

async modalSubmit() {
  if (!this.modalCanSubmit || this.outcome === null) return;
  const input =
    this.outcome === "success"
      ? { outcome: "success" as const, dartsForFinish: this.dartsForFinish as 1|2|3, dartsOnDouble: this.dartsOnDouble as 1|2|3 }
      : { outcome: "failure" as const, dartsUsed: this.dartsUsed as 1|2|3, dartsOnDouble: this.dartsOnDouble as 0|1|2|3 };
  const round = buildRoundRecord(
    this.session.state.currentRound,
    this.session.state.currentTarget,
    input,
  );
  // reuse existing fetch/timer/undo logic from current file
},
```

Remove all wizard fields: `step`, `targetHit`, `wizardNext`, `wizardBack`, `showDoubleGrid`, `finishedOnDouble`, `doubleAttempted`, `busted`, `buildInput`, `resetWizard`.

Keep: `session`, `loading`, `error`, `timerExpired`, `controlsDisabled`, `submit` renamed to `modalSubmit`, `undo`, `togglePause`, `startTimer`, `stopTimer`, `init`.

- [ ] **Step 4: Run tests**

Run: `cd app && npm test -- tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`
Expected: PASS

- [ ] **Step 5: Verification gate + commit**

```bash
cd app && npm run check && npm test && npm run build
git add app/src/lib/client/alpine/games/ten-up-one-down.play.ts app/tests/lib/client/alpine/games/ten-up-one-down.play.test.ts
git commit -m "refactor: replace wizard with pad-to-modal play flow in Alpine factory"
```

---

### Task 9: Wire Play.astro to Session

**Files:**
- Modify: `app/src/components/games/ten-up-one-down/Play.astro` (full production wiring)
- Modify: `app/scripts/curl-verify-tuod.sh` (session-aware assertions)

- [ ] **Step 1: Restore production Play.astro structure**

```astro
---
import UndoIcon from "@icons/undo.svg";
import IconBtn from "@components/ui/IconBtn.astro";
import NumberInputPad from "@components/ui/NumberInputPad.astro";
import OptionModal from "@components/ui/OptionModal.astro";
import DartCountPicker from "./DartCountPicker.astro";
import RoundProgress from "./RoundProgress.astro";
import TargetCard from "./TargetCard.astro";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";

interface Props {
  displayName: string;
  gameSession: TenUpOneDownSession;
}

const { displayName, gameSession } = Astro.props;
const sessionJson = JSON.stringify(gameSession).replace(/</g, "\\u003c");
---

<section
  class="flex-1 h-full flex flex-col gap-4"
  x-data={`tenUpOneDownPlay(${sessionJson})`}
  x-init="init()"
>
  <div class="flex justify-evenly py-2">
    <h2 class="text-xl font-semibold">{displayName}</h2>
  </div>

  <TargetCard target={gameSession.state.currentTarget} />
  <RoundProgress />

  <article class="game-panel flex-1 p-4 flex flex-col">
    <NumberInputPad
      scoreModel="score"
      submitAction="submitScore()"
      disabledExpr="controlsDisabled"
      canUndoExpr="session.roundHistory.length > 0"
      undoAction="undo()"
    />
  </article>

  <OptionModal
    openModel="showModal"
    submitAction="modalSubmit()"
    submitDisabledExpr="!modalCanSubmit || loading"
    closeAction="closeModal()"
  >
    <template x-for="question in modalQuestions" :key="question.id">
      <div x-show="question.autoValue === undefined">
        <DartCountPicker
          label="question.label"
          options="question.options"
          model="question.id"
        />
      </div>
    </template>
  </OptionModal>

  <article class="game-panel p-1 h-fit">
    <IconBtn
      ariaLabel="Go back a round"
      class="flex items-center justify-center gap-2 w-full"
      :disabled="session.roundHistory.length === 0 || loading"
      @click="undo()"
    >
      <UndoIcon class="size-6 text-text-muted" />
      <span class="text-sm text-text-muted font-mono uppercase tracking-wider">Go back</span>
    </IconBtn>
  </article>

  <p x-show="error" x-cloak x-text="error" class="text-sm text-red-400" role="alert"></p>
</section>
```

**Note:** `DartCountPicker` uses static Astro props today. For dynamic `modalQuestions`, either:
- Render pickers inline in `Play.astro` with Alpine `x-for` (duplicate picker markup), **or**
- Extend `DartCountPicker` to accept Alpine-bound label/options via `x-bind` attributes.

Preferred: inline Alpine picker markup inside the modal loop (matches existing `DartCountPicker` classes) to avoid Astro/Alpine prop bridging issues.

- [ ] **Step 2: Extend curl script**

```bash
assert_contains "$HTML" 'tenUpOneDownPlay' "Alpine factory wired"
assert_contains "$HTML" '"currentTarget":41' "session JSON embedded"
assert_contains "$HTML" 'data-testid="tuod-target-card"' "TargetCard rendered"
```

Add `data-testid="tuod-target-card"` to `TargetCard.astro` root element.

- [ ] **Step 3: Run curl smoke**

```bash
./scripts/curl-verify-tuod.sh
```

Expected: all PASS

- [ ] **Step 4: Verification gate**

```bash
cd app && npm run check && npm test && npm run build
```

Must fix any unused-import hints (current baseline has 3 hints in Play.astro).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/games/ten-up-one-down/Play.astro app/src/components/games/ten-up-one-down/TargetCard.astro app/scripts/curl-verify-tuod.sh
git commit -m "feat: wire ten-up-one-down play page to session, pad, and modal"
```

---

### Task 10: API Curl Integration Test

**Files:**
- Modify: `app/scripts/curl-verify-tuod.sh`

Extend curl script to POST a round via API and verify session advances — catches client/server record-shape mismatches.

- [ ] **Step 1: Add round POST assertions to curl script**

```bash
ROUND='{"round":{"roundNumber":1,"targetAtStart":41,"targetAfter":41,"finished":true,"dartsUsed":2,"dartsOnDouble":1}}'
ROUND_RESP=$(curl -sf -b "$JAR" -X POST "$BASE_URL/api/games/ten-up-one-down/session/round" \
  -H "Content-Type: application/json" \
  -d "$ROUND")
assert_contains "$ROUND_RESP" '"currentTarget":51' "round POST advances target"
assert_contains "$ROUND_RESP" '"currentRound":2' "round POST increments round"

UNDO_RESP=$(curl -sf -b "$JAR" -X DELETE "$BASE_URL/api/games/ten-up-one-down/session/round/last")
assert_contains "$UNDO_RESP" '"currentTarget":41' "undo restores target"
```

- [ ] **Step 2: Run curl smoke end-to-end**

```bash
./scripts/curl-verify-tuod.sh
```

Expected: all PASS

- [ ] **Step 3: Verification gate**

```bash
cd app && npm run check && npm test && npm run build && ./scripts/curl-verify-tuod.sh
```

- [ ] **Step 4: Commit**

```bash
git add app/scripts/curl-verify-tuod.sh
git commit -m "test: extend curl smoke to cover round submit and undo API"
```

---

### Task 11: Remove Deprecated Code

**Files:**
- Delete: `app/src/components/games/ten-up-one-down/RoundEntryWizard.astro`
- Delete: `app/src/components/games/ten-up-one-down/DoubleGrid.astro`
- Modify: any files still importing deleted components or removed exports

- [ ] **Step 1: Delete wizard components**

```bash
rm app/src/components/games/ten-up-one-down/RoundEntryWizard.astro
rm app/src/components/games/ten-up-one-down/DoubleGrid.astro
```

- [ ] **Step 2: Grep for stale references**

```bash
cd app && rg "RoundEntryWizard|DoubleGrid|deriveSuccessAttempts|deriveFailureAttempts|WizardInput|DoubleAttempt|doubleStats|finishedOnDouble|doubleAttempted|showDoubleGrid|wizardNext|wizardBack|resetWizard" src tests
```

Expected: no matches (except historical docs outside `app/`).

- [ ] **Step 3: Remove unused imports**

`round.ts` no longer imports `DoubleTarget`. `double-stats.ts` no longer imports `ALL_DOUBLES`. `types.ts` no longer exports `PlayerDoubleStats` unless used elsewhere.

If `PlayerDoubleStats` and per-double `doubleStats` are fully unused, remove `PlayerDoubleStats` from `types.ts`.

`doubles.ts` stays — general dart utility with its own test.

- [ ] **Step 4: Verification gate**

```bash
cd app && npm run check && npm test && npm run build && ./scripts/curl-verify-tuod.sh
```

All must pass; check must be 0/0/0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated ten-up-one-down wizard and per-double UI"
```

---

### Task 12: Final Verification Pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

```bash
cd app && npm test
```

- [ ] **Step 2: Strict check**

```bash
cd app && npm run check
```

Confirm: `0 errors`, `0 warnings`, `0 hints`.

- [ ] **Step 3: Build**

```bash
cd app && npm run build
```

- [ ] **Step 4: Curl smoke (dev server running)**

```bash
cd app && ./scripts/curl-verify-tuod.sh
```

- [ ] **Step 5: Spec coverage checklist**

| Spec § | Requirement | Verified by |
|--------|-------------|-------------|
| §2 | Empty/wrong → failure; match → success | `outcome.test.ts`, play Alpine tests |
| §3.1 | Success modal questions per constraints | `checkout-constraints.test.ts` |
| §3.2 | Failure modal always two pickers | play Alpine tests |
| §3.3 | Cross-validation client + server | `round.test.ts`, `modalCanSubmit` |
| §4 | Precomputed table + solver | solver + constraints tests |
| §5.1 | Simplified round record | `round.test.ts`, API tests |
| §5.2 | Aggregate stats + undo | `double-stats.test.ts`, round-last API |
| §6 | NumberInputPad, OptionModal, Play wiring | curl script + build |
| §9 | Edge cases (empty, wrong, forced 3-dart, paused) | tests + manual curl |
| §11 | No bust flag, no per-double breakdown | grep + deleted files |

- [ ] **Step 6: Record evidence in final report**

Paste command outputs. Do not claim complete without them.

---

## Self-Review

**Spec coverage:** All §2–§6, §9 requirements map to Tasks 1–12. Screen carousel (§11) explicitly out of scope.

**Placeholder scan:** No TBD/TODO steps. Each task includes concrete code, paths, and commands.

**Type consistency:** `RoundInput` in `round.ts`, `modalQuestions` ids, and Alpine state fields (`dartsForFinish`, `dartsOnDouble`, `dartsUsed`) align across tasks. API `validRound` fixture uses `dartsOnDouble` not `doubleAttempts`.

**Curl protocol:** UI tasks 6–10 and cleanup Task 11 run `./scripts/curl-verify-tuod.sh`. Subagents must have dev server running.

**Check gate:** Every task requires `npm run check` with 0 errors, 0 warnings, **and** 0 hints before DONE.
