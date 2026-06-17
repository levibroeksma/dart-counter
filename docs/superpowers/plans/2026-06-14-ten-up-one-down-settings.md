# Ten Up One Down Settings & Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task subagent requirements (all mandatory):**
> 1. **test-driven-development** — for any task that writes or changes code
> 2. **verification-before-completion** — run the full verification gate (below) immediately before marking the task done or committing; no completion claims without fresh command output
>
> A task is **not complete** until its verification gate step passes with evidence recorded in the subagent's final report.

**Goal:** Implement Ten Up One Down end-to-end — settings form, session model, play UI with inline round-entry wizard, round tracking, global player stats, and undo.

**Architecture:** Session document (`TenUpOneDownSession`) replaces the generic config blob for this slug. Isomorphic validators and game logic live in `lib/shared/`. Netlify Blobs store active sessions (`game-sessions`) and global stats (`player-dart-stats`). Alpine factory drives wizard state; Astro components are presentational shells.

**Tech Stack:** Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript, Netlify Blobs, Vitest, jsdom

**Branch:** TBD  
**Spec:** `docs/superpowers/specs/2026-06-14-ten-up-one-down-settings-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

**Verification order (every task after Task 1):**

```
npm run check  →  npm test  →  npm run build
```

**Dev note:** Blob persistence requires `netlify dev` from repo root. API/integration tests use mocks — no Netlify runtime required in CI.

---

## Subagent Protocol

Every implementer subagent dispatched for a task **must** read and follow `.agents/skills/verification-before-completion/SKILL.md` before reporting the task complete.

### Verification gate (final step of every task)

**Iron law:** No completion claims without fresh verification evidence from this session.

1. **Identify** what proves the task is done (see per-task expected outputs in Steps 2–4).
2. **Run** the full verification sequence from `app/`:

```
npm run check  →  npm test  →  npm run build
```

(Task 1 may skip `npm run check` if no TS surface changed yet; still run `npm test` + `npm run build`.)

3. **Read** full output for each command — confirm exit code 0 and 0 test failures.
4. **Verify** the task's **Files** list matches `git status` (no missing files, no unrelated changes).
5. **Report** actual command output in the subagent's final message (exit codes, pass counts). Do not use "should pass", "looks good", or similar.
6. **Only then** check the verification gate checkbox and proceed to Commit (if the task includes a commit step).

If any command fails: fix, re-run the **entire** sequence, and repeat the gate. Do not mark the task complete or return to the dispatcher until the gate passes.

### Dispatcher handoff

When dispatching a subagent, include in the prompt:

```
REQUIRED SUB-SKILLS: test-driven-development (code tasks), verification-before-completion (always).
Before reporting task complete: run the Verification gate in the plan's Subagent Protocol section.
Include fresh command output as evidence. Do not claim success without it.
```

---

## Design Decisions (from spec)

| Topic | Decision |
|---|---|
| Settings save | `POST /api/games/ten-up-one-down/session` (not generic `PUT config`) |
| Session key | `{userId}:ten-up-one-down` in `game-sessions` store |
| Settings persistence | Session-only; form always shows defaults |
| Play route | Load session SSR; no session → redirect to settings |
| Game completed | Delete session; redirect to `/games` (summary screen out of scope) |
| Stats scope | Global per player in `player-dart-stats` store |
| Round entry | Inline wizard in controls panel; Alpine factory owns state |
| Undo | Bottom bar; unlimited consecutive undos of last submitted round |

---

## File Structure Overview

| File | Responsibility |
|---|---|
| `src/lib/shared/darts/doubles.ts` | `DoubleTarget`, `ALL_DOUBLES` |
| `src/lib/shared/darts/bogeys.ts` | `BOGEY_NUMBERS`, `isBogey()`, `nearestNonBogey()` |
| `src/lib/shared/darts/checkouts.ts` | `getCheckoutHint()` lookup |
| `src/lib/shared/darts/checkout-hints.data.ts` | Static checkout route map |
| `src/lib/shared/stats/types.ts` | `PlayerDartStats`, `PlayerDoubleStats` |
| `src/lib/shared/stats/double-stats.ts` | `applyRoundToStats()`, `revertRoundFromStats()` |
| `src/lib/shared/games/ten-up-one-down/constants.ts` | Game rule constants |
| `src/lib/shared/games/ten-up-one-down/settings.ts` | `TenUpOneDownSettings` type |
| `src/lib/shared/games/ten-up-one-down/validation.ts` | `validateTenUpOneDownSettings()` |
| `src/lib/shared/games/ten-up-one-down/round.ts` | Round record types, derive/build/validate |
| `src/lib/shared/games/ten-up-one-down/target.ts` | `resolveTargetAfterRound()` |
| `src/lib/shared/games/ten-up-one-down/state.ts` | `createInitialGameState()`, `applyRoundToState()` |
| `src/lib/shared/games/ten-up-one-down/session.ts` | `TenUpOneDownSession` type |
| `src/lib/server/data/ten-up-one-down-session.ts` | Session blob CRUD |
| `src/lib/server/data/player-dart-stats.ts` | Global stats blob |
| `src/pages/api/games/ten-up-one-down/session.ts` | POST/GET/DELETE session |
| `src/pages/api/games/ten-up-one-down/session/round.ts` | POST round |
| `src/pages/api/games/ten-up-one-down/session/round/last.ts` | DELETE undo |
| `src/lib/client/alpine/games/ten-up-one-down.settings.ts` | Settings form factory |
| `src/lib/client/alpine/games/ten-up-one-down.play.ts` | Play wizard factory |
| `src/components/games/ten-up-one-down/SettingsForm.astro` | endMode/roundCount/playtime form |
| `src/components/games/ten-up-one-down/TenUpOneDownSettingsShell.astro` | Banner + form shell |
| `src/components/games/ten-up-one-down/Play.astro` | Play shell |
| `src/components/games/ten-up-one-down/TargetCard.astro` | Target + checkout hint |
| `src/components/games/ten-up-one-down/RoundProgress.astro` | Round counter / countdown |
| `src/components/games/ten-up-one-down/RoundEntryWizard.astro` | Wizard step templates |
| `src/components/games/ten-up-one-down/DartCountPicker.astro` | Reusable pill row |
| `src/components/games/ten-up-one-down/DoubleGrid.astro` | D1–D20 + Bull grid |
| `src/pages/games/settings-[game].astro` | Branch TUOD to dedicated shell |
| `src/pages/games/[game].astro` | SSR session load for TUOD play |

---

### Task 1: Double Targets Module

**Files:**
- Create: `app/src/lib/shared/darts/doubles.ts`
- Create: `app/tests/lib/shared/darts/doubles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ALL_DOUBLES } from "@lib/shared/darts/doubles";

describe("ALL_DOUBLES", () => {
  it("contains D1–D20 and Bull", () => {
    expect(ALL_DOUBLES).toHaveLength(21);
    expect(ALL_DOUBLES[0]).toBe("D1");
    expect(ALL_DOUBLES[19]).toBe("D20");
    expect(ALL_DOUBLES[20]).toBe("Bull");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/darts/doubles.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export type DoubleTarget =
  | "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8" | "D9" | "D10"
  | "D11" | "D12" | "D13" | "D14" | "D15" | "D16" | "D17" | "D18" | "D19" | "D20"
  | "Bull";

export const ALL_DOUBLES: readonly DoubleTarget[] = [
  "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10",
  "D11", "D12", "D13", "D14", "D15", "D16", "D17", "D18", "D19", "D20",
  "Bull",
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/shared/darts/doubles.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/darts/doubles.ts tests/lib/shared/darts/doubles.test.ts
git commit -m "feat: add shared double target constants"
```

---

### Task 2: Bogey Numbers Module

**Files:**
- Create: `app/src/lib/shared/darts/bogeys.ts`
- Create: `app/tests/lib/shared/darts/bogeys.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { BOGEY_NUMBERS, isBogey, nearestNonBogey } from "@lib/shared/darts/bogeys";

describe("bogeys", () => {
  it("identifies bogey numbers", () => {
    expect(isBogey(169)).toBe(true);
    expect(isBogey(41)).toBe(false);
  });

  it("snaps to nearest non-bogey preferring higher on success", () => {
    expect(nearestNonBogey(169, true)).toBe(170);
    expect(nearestNonBogey(168, true)).toBe(170);
  });

  it("snaps to nearest non-bogey preferring lower on failure", () => {
    expect(nearestNonBogey(169, false)).toBe(167);
    expect(nearestNonBogey(168, false)).toBe(167);
  });

  it("returns target unchanged when not bogey", () => {
    expect(nearestNonBogey(50, true)).toBe(50);
  });

  it("exports all bogey numbers", () => {
    expect(BOGEY_NUMBERS).toEqual([169, 168, 166, 165, 163, 162, 159]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/darts/bogeys.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159] as const;

export function isBogey(target: number): boolean {
  return (BOGEY_NUMBERS as readonly number[]).includes(target);
}

/**
 * Snap to nearest non-bogey; tie-break via preferHigher (direction of last adjustment).
 */
export function nearestNonBogey(target: number, preferHigher: boolean): number {
  if (!isBogey(target)) return target;

  let lower = target - 1;
  while (lower >= 2 && isBogey(lower)) lower--;

  let higher = target + 1;
  while (higher <= 170 && isBogey(higher)) higher++;

  const lowerDist = target - lower;
  const higherDist = higher - target;

  if (lowerDist < higherDist) return lower;
  if (higherDist < lowerDist) return higher;
  return preferHigher ? higher : lower;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/shared/darts/bogeys.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/darts/bogeys.ts tests/lib/shared/darts/bogeys.test.ts
git commit -m "feat: add bogey number helpers"
```

---

### Task 3: Checkout Hints Module

**Files:**
- Create: `app/src/lib/shared/darts/checkout-hints.data.ts`
- Create: `app/src/lib/shared/darts/checkouts.ts`
- Create: `app/tests/lib/shared/darts/checkouts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { getCheckoutHint } from "@lib/shared/darts/checkouts";

describe("getCheckoutHint", () => {
  it("returns route for target 41", () => {
    expect(getCheckoutHint(41)).toEqual({ segments: ["9", "D16"] });
  });

  it("returns route for target 40", () => {
    expect(getCheckoutHint(40)).toEqual({ segments: ["D20"] });
  });

  it("returns route for target 170", () => {
    expect(getCheckoutHint(170)).toEqual({ segments: ["T20", "T20", "Bull"] });
  });

  it("returns null for bogey targets", () => {
    expect(getCheckoutHint(169)).toBeNull();
  });

  it("returns null for unknown targets", () => {
    expect(getCheckoutHint(999)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/darts/checkouts.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `checkout-hints.data.ts` — generate simple routes for even scores 2–38, add explicit routes for all test targets and high checkouts:

```ts
const hints: Record<number, string[]> = {};
for (let n = 2; n <= 38; n += 2) hints[n] = [`D${n / 2}`];
Object.assign(hints, {
  40: ["D20"], 41: ["9", "D16"], 42: ["10", "D16"], 44: ["12", "D16"],
  50: ["10", "D20"], 60: ["20", "D20"], 80: ["T20", "D20"],
  100: ["T20", "D20"], 120: ["T20", "20", "D20"],
  140: ["T20", "T20", "D20"], 160: ["T20", "T20", "D20"],
  170: ["T20", "T20", "Bull"],
  167: ["T20", "T19", "Bull"], 164: ["T20", "T18", "D16"],
  161: ["T20", "T17", "D16"], 158: ["T20", "T20", "D19"],
  157: ["T20", "T19", "D20"], 156: ["T20", "T20", "D18"],
  155: ["T20", "T19", "D19"], 154: ["T20", "T18", "D20"],
  153: ["T20", "T19", "D18"], 152: ["T20", "T20", "D16"],
  151: ["T20", "T17", "D20"], 150: ["T20", "T18", "D18"],
  149: ["T20", "T19", "D16"], 148: ["T20", "T20", "D14"],
  147: ["T20", "T17", "D18"], 146: ["T20", "T18", "D16"],
  145: ["T20", "T15", "D20"], 144: ["T20", "T20", "D12"],
  143: ["T20", "T17", "D16"], 142: ["T20", "T14", "D20"],
  141: ["T20", "T19", "D12"], 139: ["T20", "T13", "D20"],
  138: ["T20", "T18", "D12"], 137: ["T20", "T19", "D10"],
  136: ["T20", "T20", "D8"], 135: ["T20", "T17", "D16"],
  134: ["T20", "T14", "D16"], 133: ["T20", "T19", "D8"],
  132: ["T20", "T20", "D6"], 131: ["T20", "T13", "D16"],
  130: ["T20", "T20", "D5"], 129: ["T19", "T20", "D16"],
  128: ["T20", "T20", "D4"], 127: ["T20", "T17", "D16"],
  126: ["T19", "T19", "D16"], 125: ["T20", "T19", "D4"],
  124: ["T20", "T16", "D16"], 123: ["T19", "T16", "D16"],
  122: ["T18", "T20", "D16"], 121: ["T20", "T15", "D16"],
  119: ["T19", "T20", "D11"], 118: ["T20", "T18", "D11"],
  117: ["T20", "T17", "D12"], 116: ["T20", "T16", "D12"],
  115: ["T20", "T15", "D14"], 114: ["T20", "T18", "D10"],
  113: ["T20", "T17", "D11"], 112: ["T20", "T20", "D6"],
  111: ["T20", "T19", "D7"], 110: ["T20", "T18", "D8"],
  109: ["T20", "T17", "D9"], 108: ["T20", "T20", "D4"],
  107: ["T20", "T19", "D5"], 106: ["T20", "T18", "D6"],
  105: ["T20", "T17", "D7"], 104: ["T20", "T20", "D2"],
  103: ["T20", "T19", "D3"], 102: ["T20", "T18", "D4"],
  101: ["T20", "T17", "D5"], 99: ["T19", "T20", "D1"],
  98: ["T20", "D19"], 97: ["T19", "D20"], 96: ["T20", "D18"],
  95: ["T19", "D19"], 94: ["T18", "D20"], 93: ["T19", "D18"],
  92: ["T20", "D16"], 91: ["T17", "D20"], 90: ["T20", "D15"],
  89: ["T19", "D16"], 88: ["T20", "D14"], 87: ["T17", "D20"],
  86: ["T18", "D16"], 85: ["T15", "D20"], 84: ["T20", "D12"],
  83: ["T19", "D13"], 82: ["T14", "D20"], 81: ["T19", "D12"],
  79: ["T19", "D11"], 78: ["T18", "D12"], 77: ["T19", "D10"],
  76: ["T20", "D8"], 75: ["T17", "D12"], 74: ["T14", "D16"],
  73: ["T19", "D8"], 72: ["T16", "D12"], 71: ["T13", "D16"],
  70: ["T20", "D5"], 69: ["T19", "D6"], 68: ["T20", "D4"],
  67: ["T17", "D8"], 66: ["T10", "D28"], 65: ["T19", "D4"],
  64: ["T16", "D8"], 63: ["T13", "D12"], 62: ["T10", "D26"],
  61: ["T15", "D8"], 59: ["T19", "D1"], 58: ["T18", "D2"],
  57: ["T17", "D3"], 56: ["T16", "D4"], 55: ["T15", "D5"],
  54: ["T14", "D6"], 53: ["T13", "D7"], 52: ["T12", "D8"],
  51: ["T11", "D10"], 49: ["T11", "D8"], 48: ["T16", "D0"],
  47: ["T15", "D1"], 46: ["T14", "D2"], 45: ["T13", "D3"],
  43: ["T13", "D1"], 39: ["T11", "D3"], 37: ["T9", "D5"],
  35: ["T7", "D7"], 33: ["T9", "D3"], 31: ["T7", "D5"],
  29: ["T5", "D7"], 27: ["T9", "D0"], 25: ["T7", "D2"],
  23: ["T7", "D0"], 21: ["T5", "D3"], 19: ["T3", "D5"],
  17: ["T7", "D0"], 15: ["T7", "D0"], 13: ["T5", "D0"],
  11: ["T3", "D0"], 9: ["T1", "D0"], 7: ["T1", "D0"], 5: ["T1", "D0"],
  3: ["T1", "D0"], 1: ["T0", "D0"],
});
// Omit bogeys: 169, 168, 166, 165, 163, 162, 159
export const CHECKOUT_HINTS = hints;
```

Create `checkouts.ts`:

```ts
import { isBogey } from "@lib/shared/darts/bogeys";
import { CHECKOUT_HINTS } from "@lib/shared/darts/checkout-hints.data";

export type CheckoutRoute = { segments: string[] };

export function getCheckoutHint(target: number): CheckoutRoute | null {
  if (isBogey(target)) return null;
  const segments = CHECKOUT_HINTS[target];
  if (!segments) return null;
  return { segments };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/shared/darts/checkouts.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/darts/checkout-hints.data.ts src/lib/shared/darts/checkouts.ts tests/lib/shared/darts/checkouts.test.ts
git commit -m "feat: add checkout hint lookup"
```

---

### Task 4: Player Stats Module

**Files:**
- Create: `app/src/lib/shared/stats/types.ts`
- Create: `app/src/lib/shared/stats/double-stats.ts`
- Create: `app/tests/lib/shared/stats/double-stats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createEmptyPlayerDartStats, applyRoundToStats, revertRoundFromStats } from "@lib/shared/stats/double-stats";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

const successRound: TenUpOneDownRoundRecord = {
  roundNumber: 1,
  targetAtStart: 41,
  targetAfter: 51,
  finished: true,
  dartsUsed: 2,
  doubleAttempts: [
    { double: "D16", hit: false },
    { double: "D16", hit: true },
  ],
};

const failureRound: TenUpOneDownRoundRecord = {
  roundNumber: 2,
  targetAtStart: 51,
  targetAfter: 50,
  finished: false,
  dartsUsed: 3,
  doubleAttempts: [{ double: "D20", hit: false }],
  busted: true,
};

describe("double-stats", () => {
  it("applies success round stats", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, successRound);
    expect(stats.doubleStats.D16).toEqual({ attempts: 2, successes: 1 });
    expect(stats.totalCheckouts).toBe(1);
    expect(stats.totalCheckoutDarts).toBe(2);
  });

  it("reverts a previously applied round", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, successRound);
    revertRoundFromStats(stats, successRound);
    expect(stats.doubleStats.D16).toEqual({ attempts: 0, successes: 0 });
    expect(stats.totalCheckouts).toBe(0);
    expect(stats.totalCheckoutDarts).toBe(0);
  });

  it("applies failure round without checkout totals", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, failureRound);
    expect(stats.doubleStats.D20).toEqual({ attempts: 1, successes: 0 });
    expect(stats.totalCheckouts).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/stats/double-stats.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `types.ts`:

```ts
import type { DoubleTarget } from "@lib/shared/darts/doubles";

export type PlayerDoubleStats = Record<DoubleTarget, { attempts: number; successes: number }>;

export type PlayerDartStats = {
  doubleStats: PlayerDoubleStats;
  totalCheckouts: number;
  totalCheckoutDarts: number;
};
```

Create `double-stats.ts` (imports `TenUpOneDownRoundRecord` from round.ts — create a minimal stub in round.ts first if Task 5 not done; implement round.ts types in this step before stats):

```ts
import { ALL_DOUBLES } from "@lib/shared/darts/doubles";
import type { PlayerDartStats } from "@lib/shared/stats/types";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

export function createEmptyPlayerDartStats(): PlayerDartStats {
  const doubleStats = Object.fromEntries(
    ALL_DOUBLES.map((d) => [d, { attempts: 0, successes: 0 }])
  ) as PlayerDartStats["doubleStats"];
  return { doubleStats, totalCheckouts: 0, totalCheckoutDarts: 0 };
}

export function applyRoundToStats(stats: PlayerDartStats, round: TenUpOneDownRoundRecord): void {
  for (const attempt of round.doubleAttempts) {
    stats.doubleStats[attempt.double].attempts++;
    if (attempt.hit) stats.doubleStats[attempt.double].successes++;
  }
  if (round.finished) {
    stats.totalCheckouts++;
    stats.totalCheckoutDarts += round.dartsUsed;
  }
}

export function revertRoundFromStats(stats: PlayerDartStats, round: TenUpOneDownRoundRecord): void {
  for (const attempt of round.doubleAttempts) {
    stats.doubleStats[attempt.double].attempts--;
    if (attempt.hit) stats.doubleStats[attempt.double].successes--;
  }
  if (round.finished) {
    stats.totalCheckouts--;
    stats.totalCheckoutDarts -= round.dartsUsed;
  }
}
```

Also create minimal `round.ts` with `TenUpOneDownRoundRecord` type only (full impl in Task 6).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/shared/stats/double-stats.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/stats/ src/lib/shared/games/ten-up-one-down/round.ts tests/lib/shared/stats/double-stats.test.ts
git commit -m "feat: add global player dart stats helpers"
```

---

### Task 5: Game Constants & Settings Type

**Files:**
- Create: `app/src/lib/shared/games/ten-up-one-down/constants.ts`
- Create: `app/src/lib/shared/games/ten-up-one-down/settings.ts`
- Create: `app/tests/lib/shared/games/ten-up-one-down/constants.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  STARTING_TARGET, DARTS_PER_ROUND, MIN_TARGET, MAX_TARGET,
  SUCCESS_DELTA, FAILURE_DELTA, DEFAULT_ROUND_COUNT, DEFAULT_PLAYTIME_SECONDS,
} from "@lib/shared/games/ten-up-one-down/constants";

describe("ten-up-one-down constants", () => {
  it("exports game rule constants", () => {
    expect(STARTING_TARGET).toBe(41);
    expect(DARTS_PER_ROUND).toBe(3);
    expect(MIN_TARGET).toBe(2);
    expect(MAX_TARGET).toBe(170);
    expect(SUCCESS_DELTA).toBe(10);
    expect(FAILURE_DELTA).toBe(-1);
    expect(DEFAULT_ROUND_COUNT).toBe(10);
    expect(DEFAULT_PLAYTIME_SECONDS).toBe(600);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/games/ten-up-one-down/constants.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`constants.ts`:

```ts
export const STARTING_TARGET = 41;
export const DARTS_PER_ROUND = 3;
export const PLAYER_COUNT = 1;
export const MIN_TARGET = 2;
export const MAX_TARGET = 170;
export const SUCCESS_DELTA = 10;
export const FAILURE_DELTA = -1;
export const DEFAULT_ROUND_COUNT = 10;
export const DEFAULT_PLAYTIME_SECONDS = 600;
export const MIN_PLAYTIME_SECONDS = 300;
export const MAX_PLAYTIME_SECONDS = 1800;
export const MIN_ROUND_COUNT = 1;
export const MAX_ROUND_COUNT = 100;
```

`settings.ts`:

```ts
export type TenUpOneDownSettings =
  | { endMode: "rounds"; roundCount: number }
  | { endMode: "timed"; playtimeSeconds: number };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/shared/games/ten-up-one-down/constants.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/games/ten-up-one-down/constants.ts src/lib/shared/games/ten-up-one-down/settings.ts tests/lib/shared/games/ten-up-one-down/constants.test.ts
git commit -m "feat: add ten-up-one-down constants and settings type"
```

---

### Task 6: Settings Validation

**Files:**
- Create: `app/src/lib/shared/games/ten-up-one-down/validation.ts`
- Create: `app/tests/lib/shared/games/ten-up-one-down/validation.test.ts`
- Modify: `app/src/lib/shared/constants/errors.constants.ts`
- Modify: `app/tests/lib/shared/constants/errors.constants.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { validateTenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/validation";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("validateTenUpOneDownSettings", () => {
  it("accepts valid rounds mode", () => {
    const result = validateTenUpOneDownSettings({ endMode: "rounds", roundCount: 10 });
    expect(result).toEqual({ valid: true, value: { endMode: "rounds", roundCount: 10 } });
  });

  it("accepts valid timed mode", () => {
    const result = validateTenUpOneDownSettings({ endMode: "timed", playtimeSeconds: 600 });
    expect(result).toEqual({ valid: true, value: { endMode: "timed", playtimeSeconds: 600 } });
  });

  it("rejects roundCount out of bounds", () => {
    const result = validateTenUpOneDownSettings({ endMode: "rounds", roundCount: 0 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe(MessageCode.INVALID_GAME_SETTINGS);
  });

  it("rejects playtime out of bounds", () => {
    const result = validateTenUpOneDownSettings({ endMode: "timed", playtimeSeconds: 60 });
    expect(result.valid).toBe(false);
  });

  it("rejects missing endMode", () => {
    const result = validateTenUpOneDownSettings({ roundCount: 10 });
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/games/ten-up-one-down/validation.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Add to `errors.constants.ts`:

```ts
INVALID_GAME_SETTINGS: "INVALID_GAME_SETTINGS",
// in errorMessages:
[MessageCode.INVALID_GAME_SETTINGS]: "Invalid game settings.",
```

`validation.ts`:

```ts
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  MIN_ROUND_COUNT, MAX_ROUND_COUNT,
  MIN_PLAYTIME_SECONDS, MAX_PLAYTIME_SECONDS,
} from "@lib/shared/games/ten-up-one-down/constants";
import type { TenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/settings";

export type ValidateSettingsResult =
  | { valid: true; value: TenUpOneDownSettings }
  | { valid: false; code: typeof MessageCode.INVALID_GAME_SETTINGS };

export function validateTenUpOneDownSettings(
  raw: Record<string, unknown>
): ValidateSettingsResult {
  const endMode = raw.endMode;
  if (endMode === "rounds") {
    const roundCount = Number(raw.roundCount);
    if (!Number.isInteger(roundCount) || roundCount < MIN_ROUND_COUNT || roundCount > MAX_ROUND_COUNT) {
      return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
    }
    return { valid: true, value: { endMode: "rounds", roundCount } };
  }
  if (endMode === "timed") {
    const playtimeSeconds = Number(raw.playtimeSeconds);
    if (!Number.isInteger(playtimeSeconds) || playtimeSeconds < MIN_PLAYTIME_SECONDS || playtimeSeconds > MAX_PLAYTIME_SECONDS) {
      return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
    }
    return { valid: true, value: { endMode: "timed", playtimeSeconds } };
  }
  return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/shared/games/ten-up-one-down/validation.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/games/ten-up-one-down/validation.ts src/lib/shared/constants/errors.constants.ts tests/
git commit -m "feat: add ten-up-one-down settings validation"
```

---

### Task 7: Round Derivation & Validation

**Files:**
- Modify: `app/src/lib/shared/games/ten-up-one-down/round.ts`
- Create: `app/tests/lib/shared/games/ten-up-one-down/round.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  deriveSuccessAttempts, deriveFailureAttempts,
  buildRoundRecord, validateRoundRecord,
} from "@lib/shared/games/ten-up-one-down/round";

describe("deriveSuccessAttempts", () => {
  it("1 dart on double", () => {
    expect(deriveSuccessAttempts(1, "D16")).toEqual([{ double: "D16", hit: true }]);
  });
  it("2 darts on double", () => {
    expect(deriveSuccessAttempts(2, "D16")).toEqual([
      { double: "D16", hit: false }, { double: "D16", hit: true },
    ]);
  });
  it("3 darts on double", () => {
    expect(deriveSuccessAttempts(3, "D16")).toHaveLength(3);
    expect(deriveSuccessAttempts(3, "D16").filter((a) => a.hit)).toHaveLength(1);
  });
});

describe("deriveFailureAttempts", () => {
  it("returns empty when onDouble is 0", () => {
    expect(deriveFailureAttempts(0, null)).toEqual([]);
  });
  it("returns misses for onDouble > 0", () => {
    expect(deriveFailureAttempts(2, "D20")).toEqual([
      { double: "D20", hit: false }, { double: "D20", hit: false },
    ]);
  });
});

describe("buildRoundRecord", () => {
  it("builds success record", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "success", dartsUsed: 2, onDouble: 2, finishedOnDouble: "D16",
    });
    expect(record.finished).toBe(true);
    expect(record.dartsUsed).toBe(2);
    expect(record.doubleAttempts).toHaveLength(2);
  });

  it("builds failure record with busted", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "failure", dartsUsed: 3, onDouble: 0, doubleAttempted: null, busted: true,
    });
    expect(record.finished).toBe(false);
    expect(record.busted).toBe(true);
    expect(record.doubleAttempts).toEqual([]);
  });
});

describe("validateRoundRecord", () => {
  it("rejects success with multiple hits", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "success", dartsUsed: 2, onDouble: 2, finishedOnDouble: "D16",
    });
    record.doubleAttempts.push({ double: "D20", hit: true });
    expect(validateRoundRecord(record).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/games/ten-up-one-down/round.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
import type { DoubleTarget } from "@lib/shared/darts/doubles";
import { MessageCode } from "@lib/shared/constants/errors.constants";

export type DoubleAttempt = { double: DoubleTarget; hit: boolean };

export type TenUpOneDownRoundRecord = {
  roundNumber: number;
  targetAtStart: number;
  targetAfter: number;
  finished: boolean;
  dartsUsed: 1 | 2 | 3;
  doubleAttempts: DoubleAttempt[];
  busted?: boolean;
};

export type WizardInput =
  | { outcome: "success"; dartsUsed: 1 | 2 | 3; onDouble: 1 | 2 | 3; finishedOnDouble: DoubleTarget }
  | { outcome: "failure"; dartsUsed: 1 | 2 | 3; onDouble: 0 | 1 | 2 | 3; doubleAttempted: DoubleTarget | null; busted: boolean };

export function deriveSuccessAttempts(onDouble: 1 | 2 | 3, finishedOnDouble: DoubleTarget): DoubleAttempt[] {
  return [
    ...Array(onDouble - 1).fill({ double: finishedOnDouble, hit: false }),
    { double: finishedOnDouble, hit: true },
  ];
}

export function deriveFailureAttempts(onDouble: 0 | 1 | 2 | 3, doubleAttempted: DoubleTarget | null): DoubleAttempt[] {
  if (onDouble === 0 || !doubleAttempted) return [];
  return Array(onDouble).fill({ double: doubleAttempted, hit: false });
}

export function buildRoundRecord(
  roundNumber: number,
  targetAtStart: number,
  input: WizardInput
): TenUpOneDownRoundRecord {
  if (input.outcome === "success") {
    const doubleAttempts = deriveSuccessAttempts(input.onDouble, input.finishedOnDouble);
    return {
      roundNumber, targetAtStart, targetAfter: targetAtStart,
      finished: true, dartsUsed: input.dartsUsed, doubleAttempts,
    };
  }
  const doubleAttempts = deriveFailureAttempts(input.onDouble, input.doubleAttempted);
  return {
    roundNumber, targetAtStart, targetAfter: targetAtStart,
    finished: false, dartsUsed: input.dartsUsed, doubleAttempts,
    busted: input.busted,
  };
}

export type ValidateRoundResult =
  | { valid: true }
  | { valid: false; code: typeof MessageCode.INVALID_ROUND };

export function validateRoundRecord(record: TenUpOneDownRoundRecord): ValidateRoundResult {
  if (record.doubleAttempts.length > record.dartsUsed) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  const hits = record.doubleAttempts.filter((a) => a.hit).length;
  if (record.finished) {
    if (hits !== 1) return { valid: false, code: MessageCode.INVALID_ROUND };
  } else {
    if (hits !== 0) return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  return { valid: true };
}
```

Add `INVALID_ROUND` to `errors.constants.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/shared/games/ten-up-one-down/round.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/games/ten-up-one-down/round.ts tests/lib/shared/games/ten-up-one-down/round.test.ts src/lib/shared/constants/errors.constants.ts
git commit -m "feat: add round derivation and validation"
```

---

### Task 8: Target Resolution

**Files:**
- Create: `app/src/lib/shared/games/ten-up-one-down/target.ts`
- Create: `app/tests/lib/shared/games/ten-up-one-down/target.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveTargetAfterRound } from "@lib/shared/games/ten-up-one-down/target";

describe("resolveTargetAfterRound", () => {
  it("adds 10 on success", () => {
    expect(resolveTargetAfterRound(41, true)).toEqual({ target: 51, completedOn170: false });
  });

  it("subtracts 1 on failure", () => {
    expect(resolveTargetAfterRound(41, false)).toEqual({ target: 40, completedOn170: false });
  });

  it("snaps bogey on success preferring higher", () => {
    expect(resolveTargetAfterRound(159, true).target).toBe(160);
  });

  it("clamps to min target 2", () => {
    expect(resolveTargetAfterRound(2, false).target).toBe(2);
  });

  it("flags completion on successful checkout at 170", () => {
    expect(resolveTargetAfterRound(170, true)).toEqual({ target: 170, completedOn170: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/games/ten-up-one-down/target.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
import { nearestNonBogey } from "@lib/shared/darts/bogeys";
import { MAX_TARGET, MIN_TARGET, SUCCESS_DELTA, FAILURE_DELTA } from "@lib/shared/games/ten-up-one-down/constants";

export type TargetResolution = { target: number; completedOn170: boolean };

export function resolveTargetAfterRound(
  currentTarget: number,
  success: boolean
): TargetResolution {
  if (success && currentTarget === MAX_TARGET) {
    return { target: MAX_TARGET, completedOn170: true };
  }

  const raw = success ? currentTarget + SUCCESS_DELTA : currentTarget + FAILURE_DELTA;
  const snapped = nearestNonBogey(raw, success);
  const clamped = Math.max(snapped, MIN_TARGET);

  return { target: clamped, completedOn170: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/shared/games/ten-up-one-down/target.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/games/ten-up-one-down/target.ts tests/lib/shared/games/ten-up-one-down/target.test.ts
git commit -m "feat: add target resolution after round"
```

---

### Task 9: Game State & Session Types

**Files:**
- Create: `app/src/lib/shared/games/ten-up-one-down/state.ts`
- Create: `app/src/lib/shared/games/ten-up-one-down/session.ts`
- Create: `app/tests/lib/shared/games/ten-up-one-down/state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createInitialGameState, applyRoundToState } from "@lib/shared/games/ten-up-one-down/state";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

const successRound: TenUpOneDownRoundRecord = {
  roundNumber: 1, targetAtStart: 41, targetAfter: 51,
  finished: true, dartsUsed: 1,
  doubleAttempts: [{ double: "D16", hit: true }],
};

describe("createInitialGameState", () => {
  it("initializes rounds mode", () => {
    const state = createInitialGameState({ endMode: "rounds", roundCount: 10 });
    expect(state).toEqual({
      currentRound: 1, currentTarget: 41, status: "active", lastAdjustment: null,
    });
  });
});

describe("applyRoundToState", () => {
  it("updates target and increments round on success", () => {
    const state = createInitialGameState({ endMode: "rounds", roundCount: 10 });
    const updated = applyRoundToState(state, successRound, { endMode: "rounds", roundCount: 10 });
    expect(updated.currentTarget).toBe(51);
    expect(updated.currentRound).toBe(2);
    expect(updated.lastAdjustment).toBe("success");
    expect(updated.status).toBe("active");
  });

  it("completes when round count exceeded", () => {
    const state = { currentRound: 10, currentTarget: 41, status: "active" as const, lastAdjustment: null };
    const updated = applyRoundToState(state, successRound, { endMode: "rounds", roundCount: 10 });
    expect(updated.status).toBe("completed");
  });

  it("completes on checkout at 170", () => {
    const state = { currentRound: 5, currentTarget: 170, status: "active" as const, lastAdjustment: null };
    const round = { ...successRound, targetAtStart: 170, targetAfter: 170 };
    const updated = applyRoundToState(state, round, { endMode: "rounds", roundCount: 10 });
    expect(updated.status).toBe("completed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/games/ten-up-one-down/state.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`session.ts`:

```ts
import type { TenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/settings";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

export type TenUpOneDownGameStatus = "active" | "paused" | "completed";

export type TenUpOneDownGameState = {
  currentRound: number;
  currentTarget: number;
  status: TenUpOneDownGameStatus;
  lastAdjustment: "success" | "failure" | null;
};

export type TenUpOneDownSession = {
  slug: "ten-up-one-down";
  settings: TenUpOneDownSettings;
  state: TenUpOneDownGameState;
  roundHistory: TenUpOneDownRoundRecord[];
  timeRemainingSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};
```

`state.ts`:

```ts
import { STARTING_TARGET } from "@lib/shared/games/ten-up-one-down/constants";
import type { TenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/settings";
import type { TenUpOneDownGameState } from "@lib/shared/games/ten-up-one-down/session";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";
import { resolveTargetAfterRound } from "@lib/shared/games/ten-up-one-down/target";

export function createInitialGameState(_settings: TenUpOneDownSettings): TenUpOneDownGameState {
  return {
    currentRound: 1,
    currentTarget: STARTING_TARGET,
    status: "active",
    lastAdjustment: null,
  };
}

export function applyRoundToState(
  state: TenUpOneDownGameState,
  round: TenUpOneDownRoundRecord,
  settings: TenUpOneDownSettings
): TenUpOneDownGameState {
  const { target, completedOn170 } = resolveTargetAfterRound(round.targetAtStart, round.finished);
  round.targetAfter = target;

  let status = state.status;
  let currentRound = state.currentRound + 1;

  if (completedOn170) {
    status = "completed";
  } else if (settings.endMode === "rounds" && currentRound > settings.roundCount) {
    status = "completed";
  }

  return {
    currentRound,
    currentTarget: target,
    status,
    lastAdjustment: round.finished ? "success" : "failure",
  };
}

export function revertRoundFromState(
  state: TenUpOneDownGameState,
  removedRound: TenUpOneDownRoundRecord
): TenUpOneDownGameState {
  return {
    currentRound: state.currentRound - 1,
    currentTarget: removedRound.targetAtStart,
    status: state.status === "completed" ? "active" : state.status,
    lastAdjustment: null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/shared/games/ten-up-one-down/state.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/games/ten-up-one-down/state.ts src/lib/shared/games/ten-up-one-down/session.ts tests/lib/shared/games/ten-up-one-down/state.test.ts
git commit -m "feat: add game state and session types"
```

---

### Task 10: Session Data Layer

**Files:**
- Create: `app/src/lib/server/data/ten-up-one-down-session.ts`
- Create: `app/tests/lib/server/data/ten-up-one-down-session.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSetJSON = vi.fn();
const mockDelete = vi.fn();

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => ({
    get: (...args: unknown[]) => mockGet(...args),
    setJSON: (...args: unknown[]) => mockSetJSON(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  })),
}));

import {
  getTenUpOneDownSession, saveTenUpOneDownSession, deleteTenUpOneDownSession,
  createTenUpOneDownSession,
} from "@lib/server/data/ten-up-one-down-session";

describe("ten-up-one-down session data layer", () => {
  beforeEach(() => { mockGet.mockReset(); mockSetJSON.mockReset(); mockDelete.mockReset(); });

  it("creates session with initial state", async () => {
    mockSetJSON.mockResolvedValue(undefined);
    const session = await createTenUpOneDownSession("alex", { endMode: "rounds", roundCount: 10 });
    expect(session.slug).toBe("ten-up-one-down");
    expect(session.state.currentTarget).toBe(41);
    expect(session.timeRemainingSeconds).toBeNull();
    expect(mockSetJSON).toHaveBeenCalledWith("alex:ten-up-one-down", expect.any(Object));
  });

  it("creates timed session with countdown", async () => {
    mockSetJSON.mockResolvedValue(undefined);
    const session = await createTenUpOneDownSession("alex", { endMode: "timed", playtimeSeconds: 600 });
    expect(session.timeRemainingSeconds).toBe(600);
  });

  it("gets existing session", async () => {
    const stored = { slug: "ten-up-one-down", state: { currentTarget: 50 } };
    mockGet.mockResolvedValue(stored);
    const session = await getTenUpOneDownSession("alex");
    expect(session?.state.currentTarget).toBe(50);
  });

  it("deletes session", async () => {
    mockDelete.mockResolvedValue(undefined);
    await deleteTenUpOneDownSession("alex");
    expect(mockDelete).toHaveBeenCalledWith("alex:ten-up-one-down");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/server/data/ten-up-one-down-session.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
import { getStore } from "@netlify/blobs";
import { createInitialGameState } from "@lib/shared/games/ten-up-one-down/state";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";
import type { TenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/settings";

const STORE = "game-sessions";
const SLUG = "ten-up-one-down";

function sessionKey(userId: string): string {
  return `${userId}:${SLUG}`;
}

export async function getTenUpOneDownSession(userId: string): Promise<TenUpOneDownSession | null> {
  const store = getStore(STORE);
  const data = await store.get(sessionKey(userId), { type: "json" });
  return (data as TenUpOneDownSession | null) ?? null;
}

export async function saveTenUpOneDownSession(userId: string, session: TenUpOneDownSession): Promise<void> {
  const store = getStore(STORE);
  session.updatedAt = new Date().toISOString();
  await store.setJSON(sessionKey(userId), session);
}

export async function deleteTenUpOneDownSession(userId: string): Promise<void> {
  const store = getStore(STORE);
  await store.delete(sessionKey(userId));
}

export async function createTenUpOneDownSession(
  userId: string,
  settings: TenUpOneDownSettings
): Promise<TenUpOneDownSession> {
  const now = new Date().toISOString();
  const session: TenUpOneDownSession = {
    slug: SLUG,
    settings,
    state: createInitialGameState(settings),
    roundHistory: [],
    timeRemainingSeconds: settings.endMode === "timed" ? settings.playtimeSeconds : null,
    createdAt: now,
    updatedAt: now,
  };
  await saveTenUpOneDownSession(userId, session);
  return session;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/server/data/ten-up-one-down-session.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/data/ten-up-one-down-session.ts tests/lib/server/data/ten-up-one-down-session.test.ts
git commit -m "feat: add ten-up-one-down session data layer"
```

---

### Task 11: Player Dart Stats Data Layer

**Files:**
- Create: `app/src/lib/server/data/player-dart-stats.ts`
- Create: `app/tests/lib/server/data/player-dart-stats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSetJSON = vi.fn();

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => ({
    get: (...args: unknown[]) => mockGet(...args),
    setJSON: (...args: unknown[]) => mockSetJSON(...args),
  })),
}));

import { getPlayerDartStats, savePlayerDartStats } from "@lib/server/data/player-dart-stats";
import { createEmptyPlayerDartStats } from "@lib/shared/stats/double-stats";

describe("player-dart-stats data layer", () => {
  beforeEach(() => { mockGet.mockReset(); mockSetJSON.mockReset(); });

  it("returns empty stats when none stored", async () => {
    mockGet.mockResolvedValue(null);
    const stats = await getPlayerDartStats("alex");
    expect(stats.totalCheckouts).toBe(0);
    expect(stats.doubleStats.D1.attempts).toBe(0);
  });

  it("saves stats", async () => {
    mockSetJSON.mockResolvedValue(undefined);
    const stats = createEmptyPlayerDartStats();
    stats.totalCheckouts = 5;
    await savePlayerDartStats("alex", stats);
    expect(mockSetJSON).toHaveBeenCalledWith("alex", stats);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/server/data/player-dart-stats.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
import { getStore } from "@netlify/blobs";
import { createEmptyPlayerDartStats } from "@lib/shared/stats/double-stats";
import type { PlayerDartStats } from "@lib/shared/stats/types";

const STORE = "player-dart-stats";

export async function getPlayerDartStats(userId: string): Promise<PlayerDartStats> {
  const store = getStore(STORE);
  const data = await store.get(userId, { type: "json" });
  return (data as PlayerDartStats | null) ?? createEmptyPlayerDartStats();
}

export async function savePlayerDartStats(userId: string, stats: PlayerDartStats): Promise<void> {
  const store = getStore(STORE);
  await store.setJSON(userId, stats);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/server/data/player-dart-stats.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/data/player-dart-stats.ts tests/lib/server/data/player-dart-stats.test.ts
git commit -m "feat: add player dart stats data layer"
```

---

### Task 12: API Types & Session Routes

**Files:**
- Modify: `app/src/lib/shared/api/types.ts`
- Create: `app/src/pages/api/games/ten-up-one-down/session.ts`
- Create: `app/tests/api/games/ten-up-one-down/session.test.ts`
- Modify: `app/src/lib/shared/constants/errors.constants.ts` (add `NO_ACTIVE_SESSION`, `SESSION_EXISTS`)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { GET, POST, DELETE } from "../../../../src/pages/api/games/ten-up-one-down/session";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockGetSession = vi.fn();
const mockCreate = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("@lib/server/auth/session", () => ({ getSession: (...a: unknown[]) => mockGetSession(...a) }));
vi.mock("@lib/server/data/ten-up-one-down-session", () => ({
  createTenUpOneDownSession: (...a: unknown[]) => mockCreate(...a),
  getTenUpOneDownSession: (...a: unknown[]) => mockGet(...a),
  deleteTenUpOneDownSession: (...a: unknown[]) => mockDelete(...a),
}));

const mockSession = { isLoggedIn: false, username: undefined as string | undefined };

function ctx(method: string, body?: unknown): APIContext {
  return {
    request: body !== undefined
      ? new Request("http://localhost/api/games/ten-up-one-down/session", {
          method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        })
      : new Request("http://localhost/api/games/ten-up-one-down/session", { method }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("ten-up-one-down session API", () => {
  beforeEach(() => {
    mockSession.isLoggedIn = false;
    mockSession.username = undefined;
    mockCreate.mockReset(); mockGet.mockReset(); mockDelete.mockReset();
    mockGetSession.mockResolvedValue(mockSession);
  });

  it("POST returns 401 when not logged in", async () => {
    const res = await POST(ctx("POST", { endMode: "rounds", roundCount: 10 }));
    expect(res.status).toBe(401);
  });

  it("POST creates session with valid settings", async () => {
    mockSession.isLoggedIn = true;
    mockSession.username = "alex";
    mockGet.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ slug: "ten-up-one-down", state: { currentTarget: 41 } });
    const res = await POST(ctx("POST", { endMode: "rounds", roundCount: 10 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.state.currentTarget).toBe(41);
  });

  it("GET returns 404 when no session", async () => {
    mockSession.isLoggedIn = true;
    mockSession.username = "alex";
    mockGet.mockResolvedValue(null);
    const res = await GET(ctx("GET"));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe(MessageCode.NO_ACTIVE_SESSION);
  });

  it("DELETE abandons session", async () => {
    mockSession.isLoggedIn = true;
    mockSession.username = "alex";
    mockDelete.mockResolvedValue(undefined);
    const res = await DELETE(ctx("DELETE"));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith("alex");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/games/ten-up-one-down/session.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Add to `api/types.ts`:

```ts
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";

export type TenUpOneDownSessionSuccess = { ok: true; session: TenUpOneDownSession };
// extend ApiSuccess union with TenUpOneDownSessionSuccess
```

`session.ts`:

```ts
import type { APIRoute } from "astro";
import { getSession } from "@lib/server/auth/session";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import type { ApiResponse } from "@lib/shared/api/types";
import { validateTenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/validation";
import {
  createTenUpOneDownSession, getTenUpOneDownSession, deleteTenUpOneDownSession,
} from "@lib/server/data/ten-up-one-down-session";

function json(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);
  if (!session.isLoggedIn || !session.username) {
    return json({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return json({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }
  const validated = validateTenUpOneDownSettings(body);
  if (!validated.valid) return json({ ok: false, code: validated.code }, 400);

  const existing = await getTenUpOneDownSession(session.username);
  if (existing) return json({ ok: false, code: MessageCode.SESSION_EXISTS }, 409);

  const created = await createTenUpOneDownSession(session.username, validated.value);
  return json({ ok: true, session: created }, 200);
};

export const GET: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  if (!session.isLoggedIn || !session.username) {
    return json({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }
  const active = await getTenUpOneDownSession(session.username);
  if (!active) return json({ ok: false, code: MessageCode.NO_ACTIVE_SESSION }, 404);
  return json({ ok: true, session: active }, 200);
};

export const DELETE: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  if (!session.isLoggedIn || !session.username) {
    return json({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }
  await deleteTenUpOneDownSession(session.username);
  return json({ ok: true }, 200);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/games/ten-up-one-down/session.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/games/ten-up-one-down/session.ts src/lib/shared/api/types.ts tests/api/games/ten-up-one-down/session.test.ts src/lib/shared/constants/errors.constants.ts
git commit -m "feat: add ten-up-one-down session API routes"
```

---

### Task 13: Round Submit API

**Files:**
- Create: `app/src/pages/api/games/ten-up-one-down/session/round.ts`
- Create: `app/tests/api/games/ten-up-one-down/round.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../../src/pages/api/games/ten-up-one-down/session/round";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockGetSession = vi.fn();
const mockGetTuod = vi.fn();
const mockSaveTuod = vi.fn();
const mockGetStats = vi.fn();
const mockSaveStats = vi.fn();

vi.mock("@lib/server/auth/session", () => ({ getSession: (...a: unknown[]) => mockGetSession(...a) }));
vi.mock("@lib/server/data/ten-up-one-down-session", () => ({
  getTenUpOneDownSession: (...a: unknown[]) => mockGetTuod(...a),
  saveTenUpOneDownSession: (...a: unknown[]) => mockSaveTuod(...a),
  deleteTenUpOneDownSession: vi.fn(),
}));
vi.mock("@lib/server/data/player-dart-stats", () => ({
  getPlayerDartStats: (...a: unknown[]) => mockGetStats(...a),
  savePlayerDartStats: (...a: unknown[]) => mockSaveStats(...a),
}));

const mockAuth = { isLoggedIn: true, username: "alex" };

const baseSession = {
  slug: "ten-up-one-down" as const,
  settings: { endMode: "rounds" as const, roundCount: 10 },
  state: { currentRound: 1, currentTarget: 41, status: "active" as const, lastAdjustment: null },
  roundHistory: [],
  timeRemainingSeconds: null,
  createdAt: "", updatedAt: "",
};

const roundBody = {
  roundNumber: 1, targetAtStart: 41, targetAfter: 41,
  finished: true, dartsUsed: 1,
  doubleAttempts: [{ double: "D16", hit: true }],
};

function ctx(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/games/ten-up-one-down/session/round", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /session/round", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(mockAuth);
    mockGetTuod.mockResolvedValue({ ...baseSession });
    mockGetStats.mockResolvedValue({ doubleStats: {}, totalCheckouts: 0, totalCheckoutDarts: 0 });
    mockSaveTuod.mockResolvedValue(undefined);
    mockSaveStats.mockResolvedValue(undefined);
  });

  it("returns 401 when not logged in", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });
    expect((await POST(ctx(roundBody))).status).toBe(401);
  });

  it("returns 404 when no active session", async () => {
    mockGetTuod.mockResolvedValue(null);
    const res = await POST(ctx(roundBody));
    expect(res.status).toBe(404);
  });

  it("submits valid round and updates session", async () => {
    const res = await POST(ctx(roundBody));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.state.currentTarget).toBe(51);
    expect(data.session.roundHistory).toHaveLength(1);
    expect(mockSaveStats).toHaveBeenCalled();
    expect(mockSaveTuod).toHaveBeenCalled();
  });

  it("rejects invalid round", async () => {
    const bad = { ...roundBody, doubleAttempts: [] };
    const res = await POST(ctx(bad));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(MessageCode.INVALID_ROUND);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/games/ten-up-one-down/round.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
import type { APIRoute } from "astro";
import { getSession } from "@lib/server/auth/session";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import type { ApiResponse } from "@lib/shared/api/types";
import { validateRoundRecord, type TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";
import { applyRoundToState } from "@lib/shared/games/ten-up-one-down/state";
import { getTenUpOneDownSession, saveTenUpOneDownSession, deleteTenUpOneDownSession } from "@lib/server/data/ten-up-one-down-session";
import { getPlayerDartStats, savePlayerDartStats } from "@lib/server/data/player-dart-stats";
import { applyRoundToStats } from "@lib/shared/stats/double-stats";

function json(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await getSession(cookies);
  if (!auth.isLoggedIn || !auth.username) return json({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);

  const session = await getTenUpOneDownSession(auth.username);
  if (!session) return json({ ok: false, code: MessageCode.NO_ACTIVE_SESSION }, 404);

  let round: TenUpOneDownRoundRecord;
  try { round = await request.json(); } catch {
    return json({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const validated = validateRoundRecord(round);
  if (!validated.valid) return json({ ok: false, code: validated.code }, 400);

  if (round.roundNumber !== session.state.currentRound || round.targetAtStart !== session.state.currentTarget) {
    return json({ ok: false, code: MessageCode.INVALID_ROUND }, 400);
  }

  const stats = await getPlayerDartStats(auth.username);
  applyRoundToStats(stats, round);
  session.state = applyRoundToState(session.state, round, session.settings);
  session.roundHistory.push(round);

  try {
    await savePlayerDartStats(auth.username, stats);
    if (session.state.status === "completed") {
      await deleteTenUpOneDownSession(auth.username);
      return json({ ok: true, session, completed: true }, 200);
    }
    await saveTenUpOneDownSession(auth.username, session);
    return json({ ok: true, session }, 200);
  } catch {
    return json({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
```

Add `completed?: boolean` to session success type if needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/games/ten-up-one-down/round.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/games/ten-up-one-down/session/round.ts tests/api/games/ten-up-one-down/round.test.ts
git commit -m "feat: add round submit API for ten-up-one-down"
```

---

### Task 14: Undo Round API

**Files:**
- Create: `app/src/pages/api/games/ten-up-one-down/session/round/last.ts`
- Create: `app/tests/api/games/ten-up-one-down/round-last.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { DELETE } from "../../../../src/pages/api/games/ten-up-one-down/session/round/last";

const mockGetSession = vi.fn();
const mockGetTuod = vi.fn();
const mockSaveTuod = vi.fn();
const mockGetStats = vi.fn();
const mockSaveStats = vi.fn();

vi.mock("@lib/server/auth/session", () => ({ getSession: (...a: unknown[]) => mockGetSession(...a) }));
vi.mock("@lib/server/data/ten-up-one-down-session", () => ({
  getTenUpOneDownSession: (...a: unknown[]) => mockGetTuod(...a),
  saveTenUpOneDownSession: (...a: unknown[]) => mockSaveTuod(...a),
}));
vi.mock("@lib/server/data/player-dart-stats", () => ({
  getPlayerDartStats: (...a: unknown[]) => mockGetStats(...a),
  savePlayerDartStats: (...a: unknown[]) => mockSaveStats(...a),
}));

const round = {
  roundNumber: 1, targetAtStart: 41, targetAfter: 51,
  finished: true, dartsUsed: 1, doubleAttempts: [{ double: "D16", hit: true }],
};

describe("DELETE /session/round/last", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ isLoggedIn: true, username: "alex" });
    mockGetTuod.mockResolvedValue({
      slug: "ten-up-one-down",
      settings: { endMode: "rounds", roundCount: 10 },
      state: { currentRound: 2, currentTarget: 51, status: "active", lastAdjustment: "success" },
      roundHistory: [round],
      timeRemainingSeconds: null, createdAt: "", updatedAt: "",
    });
    mockGetStats.mockResolvedValue({ doubleStats: { D16: { attempts: 1, successes: 1 } }, totalCheckouts: 1, totalCheckoutDarts: 1 });
  });

  it("reverts last round and stats", async () => {
    const res = await DELETE({ cookies: {} } as APIContext);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.session.state.currentTarget).toBe(41);
    expect(data.session.state.currentRound).toBe(1);
    expect(data.session.roundHistory).toHaveLength(0);
    expect(mockSaveStats).toHaveBeenCalled();
  });

  it("restores active from completed", async () => {
    mockGetTuod.mockResolvedValue({
      slug: "ten-up-one-down",
      settings: { endMode: "rounds", roundCount: 1 },
      state: { currentRound: 2, currentTarget: 51, status: "completed", lastAdjustment: "success" },
      roundHistory: [round],
      timeRemainingSeconds: null, createdAt: "", updatedAt: "",
    });
    const res = await DELETE({ cookies: {} } as APIContext);
    expect((await res.json()).session.state.status).toBe("active");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/games/ten-up-one-down/round-last.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
import type { APIRoute } from "astro";
import { getSession } from "@lib/server/auth/session";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import type { ApiResponse } from "@lib/shared/api/types";
import { revertRoundFromState } from "@lib/shared/games/ten-up-one-down/state";
import { getTenUpOneDownSession, saveTenUpOneDownSession } from "@lib/server/data/ten-up-one-down-session";
import { getPlayerDartStats, savePlayerDartStats } from "@lib/server/data/player-dart-stats";
import { revertRoundFromStats } from "@lib/shared/stats/double-stats";

function json(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const DELETE: APIRoute = async ({ cookies }) => {
  const auth = await getSession(cookies);
  if (!auth.isLoggedIn || !auth.username) return json({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);

  const session = await getTenUpOneDownSession(auth.username);
  if (!session || session.roundHistory.length === 0) {
    return json({ ok: false, code: MessageCode.INVALID_ROUND }, 400);
  }

  const removed = session.roundHistory.pop()!;
  const stats = await getPlayerDartStats(auth.username);
  revertRoundFromStats(stats, removed);
  session.state = revertRoundFromState(session.state, removed);

  await savePlayerDartStats(auth.username, stats);
  await saveTenUpOneDownSession(auth.username, session);
  return json({ ok: true, session }, 200);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/games/ten-up-one-down/round-last.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/games/ten-up-one-down/session/round/last.ts tests/api/games/ten-up-one-down/round-last.test.ts
git commit -m "feat: add undo last round API for ten-up-one-down"
```

---

### Task 15: Settings Form & Alpine Factory

**Files:**
- Create: `app/src/lib/client/alpine/games/ten-up-one-down.settings.ts`
- Modify: `app/src/lib/client/alpine/app.factory.ts`
- Modify: `app/src/components/games/ten-up-one-down/SettingsForm.astro`
- Create: `app/src/components/games/ten-up-one-down/TenUpOneDownSettingsShell.astro`
- Modify: `app/src/pages/games/settings-[game].astro`
- Create: `app/tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tenUpOneDownSettings } from "@lib/client/alpine/games/ten-up-one-down.settings";

describe("tenUpOneDownSettings", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="game-settings-form">
        <input name="endMode" value="rounds" />
        <input name="roundCount" value="10" />
      </form>`;
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("POSTs session and navigates on success", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ ok: true, session: {} }),
    } as Response);
    const factory = tenUpOneDownSettings("/games/ten-up-one-down", false);
    await factory.start();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/games/ten-up-one-down/session",
      expect.objectContaining({ method: "POST" })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`ten-up-one-down.settings.ts`:

```ts
import type { ApiResponse, TenUpOneDownSessionSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { t } from "@lib/shared/i18n";
import { playPath } from "@lib/shared/games/paths";

interface TenUpOneDownSettingsState {
  playUrl: string;
  hasActiveSession: boolean;
  loading: boolean;
  error: string;
  formDataToSettings(form: HTMLFormElement): Record<string, unknown>;
  start(): Promise<void>;
  resume(): void;
  async abandon(): Promise<void>;
}

export function tenUpOneDownSettings(
  playUrl: string,
  hasActiveSession: boolean
): TenUpOneDownSettingsState {
  return {
    playUrl,
    hasActiveSession,
    loading: false,
    error: "",

    formDataToSettings(form: HTMLFormElement): Record<string, unknown> {
      const settings: Record<string, unknown> = {};
      for (const [key, value] of new FormData(form).entries()) {
        if (typeof value === "string") {
          settings[key] = key === "roundCount" || key === "playtimeSeconds" ? Number(value) : value;
        }
      }
      return settings;
    },

    resume() {
      window.location.href = this.playUrl;
    },

    async abandon() {
      this.loading = true;
      try {
        await fetch("/api/games/ten-up-one-down/session", { method: "DELETE" });
        this.hasActiveSession = false;
      } finally {
        this.loading = false;
      }
    },

    async start() {
      const form = document.getElementById("game-settings-form") as HTMLFormElement | null;
      if (!form) return;
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/ten-up-one-down/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.formDataToSettings(form)),
        });
        const data: ApiResponse = await response.json();
        if (!data.ok) {
          this.error = data.code ? t(data.code) : t(MessageCode.SERVER_ERROR);
          return;
        }
        window.location.href = this.playUrl;
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },
  };
}
```

Register in `app.factory.ts`: `Alpine.data("tenUpOneDownSettings", tenUpOneDownSettings);`

`SettingsForm.astro` — replace placeholder with:

```astro
---
import { DEFAULT_ROUND_COUNT, DEFAULT_PLAYTIME_SECONDS } from "@lib/shared/games/ten-up-one-down/constants";
---
<fieldset class="space-y-4">
  <legend class="text-text-muted text-sm">End mode</legend>
  <label class="flex items-center gap-2">
    <input type="radio" name="endMode" value="rounds" checked class="radio" />
    <span>Rounds</span>
  </label>
  <label class="flex items-center gap-2">
    <input type="radio" name="endMode" value="timed" class="radio" />
    <span>Timed</span>
  </label>
</fieldset>
<label class="block space-y-1" x-show="$el.closest('form') && document.querySelector('[name=endMode]:checked')?.value === 'rounds'">
  <span class="text-text-muted text-sm">Number of rounds</span>
  <input type="number" name="roundCount" value={DEFAULT_ROUND_COUNT} min="1" max="100" class="input w-full" />
</label>
<label class="block space-y-1" x-show="$el.closest('form') && document.querySelector('[name=endMode]:checked')?.value === 'timed'">
  <span class="text-text-muted text-sm">Play time (seconds)</span>
  <input type="number" name="playtimeSeconds" value={DEFAULT_PLAYTIME_SECONDS} min="300" max="1800" step="60" class="input w-full" />
</label>
```

`TenUpOneDownSettingsShell.astro`:

```astro
---
import PrimaryBtn from "@components/ui/PrimaryBtn.astro";
import { playPath } from "@lib/shared/games/paths";
import type { GameType } from "@lib/shared/games/types";

interface Props { game: GameType; hasActiveSession: boolean; }
const { game, hasActiveSession } = Astro.props;
const playUrl = playPath(game.slug);
---
<main class="mx-auto w-full max-w-2xl flex-1 p-4 @sm:p-6"
  x-data={`tenUpOneDownSettings('${playUrl}', ${hasActiveSession})`}>
  <!-- header same as GameSettingsShell -->
  <div x-show="hasActiveSession" x-cloak class="mb-4 rounded-lg border border-amber-600/50 bg-amber-950/30 p-4">
    <p class="font-medium">Game in progress</p>
    <div class="mt-2 flex gap-2">
      <PrimaryBtn type="button" @click="resume()">Resume</PrimaryBtn>
      <button type="button" class="btn-press rounded-full px-4 py-2.5" @click="abandon()">Abandon & start new</button>
    </div>
  </div>
  <form id="game-settings-form" class="space-y-4" @submit.prevent="start()">
    <slot />
    <p x-show="error" x-text="error" x-cloak class="text-sm text-red-400" role="alert"></p>
    <PrimaryBtn type="submit" x-show="!hasActiveSession">Start playing</PrimaryBtn>
  </form>
</main>
```

Update `settings-[game].astro` — when `slug === "ten-up-one-down"`:
- SSR: `getTenUpOneDownSession(session.username)` for banner
- Render `TenUpOneDownSettingsShell` instead of `GameSettingsShell`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/client/alpine/games/ten-up-one-down.settings.ts src/lib/client/alpine/app.factory.ts src/components/games/ten-up-one-down/ tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts src/pages/games/settings-[game].astro
git commit -m "feat: add ten-up-one-down settings form and shell"
```

---

### Task 16: Play Subcomponents

**Files:**
- Create: `app/src/components/games/ten-up-one-down/DartCountPicker.astro`
- Create: `app/src/components/games/ten-up-one-down/DoubleGrid.astro`
- Create: `app/src/components/games/ten-up-one-down/TargetCard.astro`
- Create: `app/src/components/games/ten-up-one-down/RoundProgress.astro`

- [ ] **Step 1: Create `DartCountPicker.astro`**

Props: `label`, `options: number[]`, Alpine bindings via slot attrs or passed `xModel` name.

```astro
---
interface Props { label: string; options: number[]; model: string; }
const { label, options, model } = Astro.props;
---
<div class="flex flex-col w-full gap-2">
  <h3 class="font-bold text-xs">{label}</h3>
  <div class="flex items-center justify-center gap-2">
    {options.map((n) => (
      <div
        class="card w-full flex justify-center items-center text-sm cursor-pointer"
        @click={`${model} = ${n}`}
        :class={`${model} === ${n} ? 'bg-accent text-accent-foreground' : ''`}
      >{n}</div>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Create `DoubleGrid.astro`**

```astro
---
import { ALL_DOUBLES } from "@lib/shared/darts/doubles";
interface Props { label: string; model: string; }
const { label, model } = Astro.props;
---
<div class="flex flex-col flex-1 w-full gap-2">
  <h3 class="font-bold text-xs">{label}</h3>
  <div class="flex-1 grid grid-cols-5 gap-2">
    {ALL_DOUBLES.map((d, i) => (
      <div
        class:list={["card w-full flex justify-center items-center text-xs cursor-pointer", d === "Bull" && "col-start-3"]}
        @click={`${model} = '${d}'`}
        :class={`${model} === '${d}' ? 'bg-accent text-accent-foreground' : ''`}
      >{d === "Bull" ? "BULL" : d}</div>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Create `TargetCard.astro`**

Props: `target` (number, bound via Alpine parent). Renders target score + checkout hint segments from `getCheckoutHint`.

- [ ] **Step 4: Create `RoundProgress.astro`**

Props bound from Alpine: `endMode`, `currentRound`, `roundCount`, `timeRemainingSeconds`, `status`.
- Rounds mode: `Round N of M`
- Timed mode: `Round N · MM:SS` + pause toggle button

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures. (No new test file for this task — existing suite must still pass.)

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/components/games/ten-up-one-down/DartCountPicker.astro src/components/games/ten-up-one-down/DoubleGrid.astro src/components/games/ten-up-one-down/TargetCard.astro src/components/games/ten-up-one-down/RoundProgress.astro
git commit -m "feat: add ten-up-one-down play subcomponents"
```

---

### Task 17: Round Entry Wizard Component

**Files:**
- Create: `app/src/components/games/ten-up-one-down/RoundEntryWizard.astro`

- [ ] **Step 1: Create wizard templates**

Import `DartCountPicker`, `DoubleGrid`. All state lives in Alpine parent (`tenUpOneDownPlay`). Wizard renders steps via `x-show` on `step` enum:

| `step` | Content |
|---|---|
| `outcome` | Target hit? Yes / No |
| `dartsUsed` | DartCountPicker 1/2/3 |
| `onDouble` | DartCountPicker (success: 1–3; failure: 0–3) |
| `doubleSelect` | DoubleGrid (slides in when dartsUsed + onDouble set) |
| `busted` | Busted? Yes / No (failure only) |
| `submit` | Submit button |

Slide transition: wrap dartsUsed/onDouble in an article with `x-show="showDartSteps"`; double grid with `x-show="showDoubleGrid"` and CSS translate transition matching prototype.

- [ ] **Step 2: Wire wizard back**

Each step's back is handled by Alpine `wizardBack()` — not in Astro.

- [ ] **Step 3: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/games/ten-up-one-down/RoundEntryWizard.astro
git commit -m "feat: add inline round entry wizard component"
```

---

### Task 18: Play Alpine Factory

**Files:**
- Create: `app/src/lib/client/alpine/games/ten-up-one-down.play.ts`
- Modify: `app/src/lib/client/alpine/app.factory.ts`
- Create: `app/tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tenUpOneDownPlay } from "@lib/client/alpine/games/ten-up-one-down.play";

const session = {
  slug: "ten-up-one-down" as const,
  settings: { endMode: "rounds" as const, roundCount: 10 },
  state: { currentRound: 1, currentTarget: 41, status: "active" as const, lastAdjustment: null },
  roundHistory: [],
  timeRemainingSeconds: null,
  createdAt: "", updatedAt: "",
};

describe("tenUpOneDownPlay", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("starts at outcome step", () => {
    const play = tenUpOneDownPlay(session);
    expect(play.step).toBe("outcome");
  });

  it("advances success flow steps", () => {
    const play = tenUpOneDownPlay(session);
    play.targetHit = true;
    play.wizardNext();
    expect(play.step).toBe("dartsUsed");
    play.dartsUsed = 2;
    play.onDouble = 2;
    play.wizardNext();
    expect(play.step).toBe("doubleSelect");
  });

  it("wizardBack returns to previous step", () => {
    const play = tenUpOneDownPlay(session);
    play.targetHit = true;
    play.wizardNext();
    play.dartsUsed = 1;
    play.wizardBack();
    expect(play.step).toBe("outcome");
  });

  it("resetWizard clears fields after submit", () => {
    const play = tenUpOneDownPlay(session);
    play.targetHit = true;
    play.dartsUsed = 1;
    play.onDouble = 1;
    play.finishedOnDouble = "D16";
    play.resetWizard();
    expect(play.step).toBe("outcome");
    expect(play.targetHit).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";
import type { DoubleTarget } from "@lib/shared/darts/doubles";
import { buildRoundRecord, type WizardInput } from "@lib/shared/games/ten-up-one-down/round";
import type { ApiResponse, TenUpOneDownSessionSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { t } from "@lib/shared/i18n";

type WizardStep = "outcome" | "dartsUsed" | "onDouble" | "doubleSelect" | "busted" | "submit";

export function tenUpOneDownPlay(initialSession: TenUpOneDownSession) {
  let timerId: ReturnType<typeof setInterval> | null = null;

  return {
    session: initialSession,
    step: "outcome" as WizardStep,
    targetHit: null as boolean | null,
    dartsUsed: 0 as 0 | 1 | 2 | 3,
    onDouble: 0 as 0 | 1 | 2 | 3,
    finishedOnDouble: null as DoubleTarget | null,
    doubleAttempted: null as DoubleTarget | null,
    busted: null as boolean | null,
    loading: false,
    error: "",
    timerExpired: false,

    get isSuccess() { return this.targetHit === true; },
    get controlsDisabled() { return this.session.state.status === "paused" || this.loading; },
    get showDartSteps() { return this.targetHit !== null && ["dartsUsed", "onDouble"].includes(this.step); },
    get showDoubleGrid() {
      if (this.step !== "doubleSelect") return false;
      if (this.isSuccess) return this.dartsUsed > 0 && this.onDouble > 0;
      return this.onDouble > 0;
    },

    wizardNext() {
      if (this.step === "outcome" && this.targetHit !== null) { this.step = "dartsUsed"; return; }
      if (this.step === "dartsUsed" && this.dartsUsed > 0) { this.step = "onDouble"; return; }
      if (this.step === "onDouble" && this.onDouble >= 0) {
        if (this.isSuccess || this.onDouble > 0) { this.step = "doubleSelect"; return; }
        this.step = "busted";
        return;
      }
      if (this.step === "doubleSelect") {
        this.step = this.isSuccess ? "submit" : "busted";
        return;
      }
      if (this.step === "busted" && this.busted !== null) this.step = "submit";
    },

    wizardBack() {
      if (this.step === "submit") { this.step = this.isSuccess ? "doubleSelect" : "busted"; return; }
      if (this.step === "busted") {
        this.step = this.onDouble > 0 ? "doubleSelect" : "onDouble";
        return;
      }
      if (this.step === "doubleSelect") { this.step = "onDouble"; return; }
      if (this.step === "onDouble") { this.step = "dartsUsed"; return; }
      if (this.step === "dartsUsed") { this.step = "outcome"; return; }
    },

    resetWizard() {
      this.step = "outcome";
      this.targetHit = null;
      this.dartsUsed = 0;
      this.onDouble = 0;
      this.finishedOnDouble = null;
      this.doubleAttempted = null;
      this.busted = null;
    },

    buildInput(): WizardInput {
      if (this.isSuccess) {
        return {
          outcome: "success",
          dartsUsed: this.dartsUsed as 1 | 2 | 3,
          onDouble: this.onDouble as 1 | 2 | 3,
          finishedOnDouble: this.finishedOnDouble!,
        };
      }
      return {
        outcome: "failure",
        dartsUsed: this.dartsUsed as 1 | 2 | 3,
        onDouble: this.onDouble as 0 | 1 | 2 | 3,
        doubleAttempted: this.doubleAttempted,
        busted: this.busted!,
      };
    },

    async submit() {
      const record = buildRoundRecord(
        this.session.state.currentRound,
        this.session.state.currentTarget,
        this.buildInput()
      );
      this.loading = true;
      try {
        const response = await fetch("/api/games/ten-up-one-down/session/round", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round: record, timerExpired: this.timerExpired }),
        });
        const data = await response.json() as ApiResponse & { completed?: boolean };
        if (!data.ok) {
          this.error = data.code ? t(data.code) : t(MessageCode.SERVER_ERROR);
          return;
        }
        const success = data as TenUpOneDownSessionSuccess & { completed?: boolean };
        if (success.completed) {
          window.location.href = "/games";
          return;
        }
        this.session = success.session;
        this.resetWizard();
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    async undo() {
      this.loading = true;
      try {
        const response = await fetch("/api/games/ten-up-one-down/session/round/last", { method: "DELETE" });
        const data = await response.json() as TenUpOneDownSessionSuccess;
        if (data.ok) this.session = data.session;
      } finally {
        this.loading = false;
      }
    },

    togglePause() {
      if (this.session.settings.endMode !== "timed") return;
      this.session.state.status = this.session.state.status === "paused" ? "active" : "paused";
      if (this.session.state.status === "active") this.startTimer();
      else this.stopTimer();
    },

    startTimer() {
      this.stopTimer();
      if (this.session.settings.endMode !== "timed") return;
      timerId = setInterval(() => {
        if (this.session.state.status !== "active") return;
        if (this.session.timeRemainingSeconds === null) return;
        if (this.session.timeRemainingSeconds <= 0) {
          this.timerExpired = true;
          this.stopTimer();
          return;
        }
        this.session.timeRemainingSeconds--;
      }, 1000);
    },

    stopTimer() {
      if (timerId) { clearInterval(timerId); timerId = null; }
    },

    init() {
      this.startTimer();
    },
  };
}
```

Register: `Alpine.data("tenUpOneDownPlay", tenUpOneDownPlay);`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/client/alpine/games/ten-up-one-down.play.ts src/lib/client/alpine/app.factory.ts tests/lib/client/alpine/games/ten-up-one-down.play.test.ts
git commit -m "feat: add ten-up-one-down play Alpine factory"
```

---

### Task 19: Play Page Integration

**Files:**
- Modify: `app/src/components/games/ten-up-one-down/Play.astro`
- Modify: `app/src/pages/games/[game].astro`

- [ ] **Step 1: Update Play.astro**

Replace inline `x-data` prototype with shell mounting factory:

```astro
---
import UndoIcon from "@icons/undo.svg";
import IconBtn from "@components/ui/IconBtn.astro";
import TargetCard from "./TargetCard.astro";
import RoundProgress from "./RoundProgress.astro";
import RoundEntryWizard from "./RoundEntryWizard.astro";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";

interface Props {
  displayName: string;
  slug: string;
  session: TenUpOneDownSession;
}
const { displayName, session } = Astro.props;
const sessionJson = JSON.stringify(session).replace(/</g, "\\u003c");
---
<section class="flex-1 flex flex-col gap-4" x-data={`tenUpOneDownPlay(${sessionJson})`} x-init="init()">
  <div class="flex justify-evenly py-2">
    <h2 class="text-2xl font-bold">{displayName}</h2>
  </div>
  <TargetCard />
  <RoundProgress />
  <article class="bg-border flex-1 h-fit p-6 rounded-lg flex flex-col shadow-card border border-slate-700">
    <RoundEntryWizard />
  </article>
  <article class="bg-border h-fit p-2 rounded-lg flex items-center justify-center shadow-card border border-slate-700">
    <IconBtn ariaLabel="Go back a round" class="flex items-center justify-center gap-2" @click="undo()" :disabled="session.roundHistory.length === 0 || loading">
      <UndoIcon class="size-6 text-text-muted" />
      <span class="text-sm text-text-muted uppercase font-mono tracking-wider">Go back</span>
    </IconBtn>
  </article>
</section>
```

- [ ] **Step 2: Update `[game].astro` for ten-up-one-down**

When `slug === "ten-up-one-down"`:
1. Load `getTenUpOneDownSession(session.username)`
2. If no session → `Astro.redirect(settingsPath(slug))`
3. Pass `session` prop to `Play` component

Update `Play` component props type in registry usage (cast or conditional render).

- [ ] **Step 3: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/games/ten-up-one-down/Play.astro src/pages/games/[game].astro
git commit -m "feat: wire ten-up-one-down play page to session"
```

---

### Task 20: Timed Mode Timer & Pause

**Files:**
- Modify: `app/src/lib/client/alpine/games/ten-up-one-down.play.ts`
- Modify: `app/tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("pauses and resumes timed countdown", () => {
  vi.useFakeTimers();
  const timedSession = {
    ...session,
    settings: { endMode: "timed" as const, playtimeSeconds: 60 },
    timeRemainingSeconds: 60,
  };
  const play = tenUpOneDownPlay(timedSession);
  play.init();
  vi.advanceTimersByTime(5000);
  expect(play.session.timeRemainingSeconds).toBe(55);
  play.togglePause();
  expect(play.session.state.status).toBe("paused");
  vi.advanceTimersByTime(5000);
  expect(play.session.timeRemainingSeconds).toBe(55);
  play.togglePause();
  vi.advanceTimersByTime(5000);
  expect(play.session.timeRemainingSeconds).toBe(50);
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement timer logic**

- `init()`: if timed mode, start 1s interval decrementing `session.timeRemainingSeconds` while `status === "active"`
- `togglePause()`: flip `session.state.status`; clear/restart interval
- On timer reaching 0: set `timerExpired = true`; after next round submit, force `status: "completed"` server-side or client redirect
- Server round handler: if `timerExpired` flag sent or `timeRemainingSeconds === 0`, mark completed after round resolves

Add optional `timerExpired` POST field or check `timeRemainingSeconds <= 0` in round API.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`  
Expected: PASS

- [ ] **Step 5: Verification gate (REQUIRED SUB-SKILL: verification-before-completion)**

Read `.agents/skills/verification-before-completion/SKILL.md`. Run from `app/`:

```
npm run check  →  npm test  →  npm run build
```

Expected: all commands exit 0; test output shows 0 failures.

Record actual output (exit codes, pass counts) in your final report. Do not mark this task done or proceed to Commit until the gate passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/client/alpine/games/ten-up-one-down.play.ts tests/lib/client/alpine/games/ten-up-one-down.play.test.ts src/pages/api/games/ten-up-one-down/session/round.ts
git commit -m "feat: add timed mode countdown and pause"
```

---

## Spec Coverage Checklist

| Spec § | Requirement | Task |
|---|---|---|
| §2 | Settings form fields & validation | Task 5, 6, 15 |
| §2 | In-progress session banner | Task 15 |
| §3 | Session data flow | Task 10–14 |
| §5 | Session & state types | Task 9 |
| §6 | Round record & derivation | Task 7 |
| §6 | Target resolution | Task 8 |
| §7 | Play screen layout | Task 16, 17, 19 |
| §8 | Success wizard flow | Task 17, 18 |
| §9 | Failure wizard flow | Task 17, 18 |
| §10 | Pause & timer | Task 20 |
| §11 | Shared dart modules | Task 1–3 |
| §12 | Global player stats | Task 4, 11, 13, 14 |
| §13 | Undo (go back) | Task 14, 18, 19 |
| §14 | Components & wizard state | Task 16–19 |
| §15 | API routes | Task 12–14 |
| §16 | Testing layers | All tasks |
| §17 | Game completed redirect | Task 13, 19 (`/games`) |

**Gaps:** None identified.

---

## Manual Test Plan

- [ ] `/games/settings-ten-up-one-down` shows defaults (rounds, 10 rounds)
- [ ] Start creates session and redirects to play
- [ ] Play page shows target 41 with checkout hint
- [ ] Success flow: Yes → darts → on double → double grid → Submit → target +10
- [ ] Failure flow: No → darts → on double (incl. 0) → busted → Submit → target −1
- [ ] Go back undoes last round (target + stats revert)
- [ ] Consecutive undos work
- [ ] In-progress banner on settings: Resume / Abandon
- [ ] Timed mode: countdown, pause freezes timer and disables wizard
- [ ] Game ends after N rounds; session deleted; redirects to `/games`
- [ ] Successful checkout on 170 ends game
- [ ] Bogey snap visible when target lands on bogey number

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-14-ten-up-one-down-settings.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task; each subagent runs **verification-before-completion** (plan Subagent Protocol) before reporting done; review between tasks

**2. Inline Execution** — execute tasks in this session using executing-plans; run the verification gate at each task checkpoint

**Which approach?**
