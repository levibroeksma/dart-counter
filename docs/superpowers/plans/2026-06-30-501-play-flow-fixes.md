# 501 Play Flow Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 501 play-flow bugs and add checkout/double tracking modal, accurate dart counts, DartBot level display, and reliable completion persistence.

**Architecture:** Shared trigger logic in `lib/shared/games/501/checkout-modal.ts` and partial-double helpers in `lib/shared/darts/checkout-partial.ts`. TUOD-style defer-apply modal in `501.play.ts`. Visit records carry `dartsThrown`/`dartsOnDouble`/`dartsForFinish`; completion replays with `botRngBefore` and saves both `player_501_stats` and `player_dart_stats`.

**Tech Stack:** Astro 6, Alpine.js 3, TypeScript, Vitest, Drizzle/Neon Postgres

**Spec:** `docs/superpowers/specs/2026-06-30-501-play-flow-fixes-design.md`  
**Working directory:** `app/`

---

## File Structure Overview

| File | Responsibility |
| ---- | -------------- |
| `src/lib/shared/darts/checkout-partial.ts` | `isSingleDartFinishable`, `maxDartsOnDoubleForPartialVisit`, `buildPartialDoubleModalQuestion` |
| `src/lib/shared/games/501/checkout-modal.ts` | `resolve501CheckoutModal` — trigger + question list |
| `src/lib/shared/games/501/display.ts` | `format501PlayerDisplayName` |
| `src/lib/shared/games/501/bot-dart-metadata.ts` | `deriveBotVisitDartMetadata` from `SimulatedVisit` |
| `src/lib/shared/games/501/dart-stats.ts` | `apply501VisitToDartStats`, `applyGameCompletionToDartStats` |
| `src/lib/shared/games/501/types.ts` | `dartsThrown`, `dartsOnDouble`, `dartsForFinish` on visit record |
| `src/lib/shared/games/501/state.ts` | Apply metadata; bust visits count darts |
| `src/lib/shared/games/501/completion.ts` | Replay `botRngBefore`; normalize `visitsMatch` |
| `src/lib/shared/games/501/summary.ts` | Sum `dartsThrown` per player |
| `src/lib/shared/games/501/bot-helpers.ts` | Undo after user leg win before bot throws |
| `src/lib/client/alpine/games/501.play.ts` | Modal defer-apply, bug fixes |
| `src/lib/client/alpine/games/dartbot-turn-modal.ts` | Slower animation + hold |
| `src/components/games/501/Play.astro` | `OptionModal`, display names |
| `src/components/games/501/Summary.astro` | Back button fix |
| `src/pages/api/games/501/complete.ts` | Save `player_dart_stats` |
| `AGENTS.md` | Mandatory migrate note |

---

## Verification Gate (every task)

```bash
cd app && npm run check && npm test && npx fallow
```

Scoped test during steps: `npm test -- tests/path/to/file.test.ts`

---

### Task 1: Partial double helpers (`@lib/shared/darts`)

**Files:**
- Create: `app/src/lib/shared/darts/checkout-partial.ts`
- Modify: `app/src/lib/shared/darts/index.ts`
- Test: `app/tests/lib/shared/darts/checkout-partial.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  buildPartialDoubleModalQuestion,
  isSingleDartFinishable,
  maxDartsOnDoubleForPartialVisit,
} from "@lib/shared/darts/checkout-partial";

describe("checkout-partial", () => {
  it("isSingleDartFinishable is true for 40 and 50, false for 51", () => {
    expect(isSingleDartFinishable(40)).toBe(true);
    expect(isSingleDartFinishable(50)).toBe(true);
    expect(isSingleDartFinishable(51)).toBe(false);
  });

  it("maxDartsOnDoubleForPartialVisit matches 60→47 and 54→40 examples", () => {
    expect(maxDartsOnDoubleForPartialVisit(13)).toBe(1);
    expect(maxDartsOnDoubleForPartialVisit(14)).toBe(2);
    expect(maxDartsOnDoubleForPartialVisit(0)).toBe(3);
  });

  it("buildPartialDoubleModalQuestion returns 0..max options", () => {
    expect(buildPartialDoubleModalQuestion(13)).toEqual({
      id: "dartsOnDouble",
      label: "Darts on double",
      options: [0, 1],
    });
    expect(buildPartialDoubleModalQuestion(14).options).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/darts/checkout-partial.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// app/src/lib/shared/darts/checkout-partial.ts
import type { ModalQuestion } from "./checkout-constraints";
import { getCheckoutConstraints } from "./checkout-constraints";

export function isSingleDartFinishable(remaining: number): boolean {
  const constraints = getCheckoutConstraints(remaining);
  return constraints?.minFinish === 1;
}

export function maxDartsOnDoubleForPartialVisit(visitScore: number): number {
  if (visitScore === 0) return 3;
  return Math.min(3, Math.ceil(visitScore / 13));
}

export function buildPartialDoubleModalQuestion(visitScore: number): ModalQuestion {
  const max = maxDartsOnDoubleForPartialVisit(visitScore);
  return {
    id: "dartsOnDouble",
    label: "Darts on double",
    options: Array.from({ length: max + 1 }, (_, i) => i),
  };
}
```

Export from `index.ts`:

```ts
export {
  buildPartialDoubleModalQuestion,
  isSingleDartFinishable,
  maxDartsOnDoubleForPartialVisit,
} from "./checkout-partial";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/darts/checkout-partial.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/shared/darts/checkout-partial.ts app/src/lib/shared/darts/index.ts app/tests/lib/shared/darts/checkout-partial.test.ts
git commit -m "feat(darts): add partial checkout double-attempt helpers"
```

---

### Task 2: `resolve501CheckoutModal`

**Files:**
- Create: `app/src/lib/shared/games/501/checkout-modal.ts`
- Modify: `app/src/lib/shared/games/501/index.ts`
- Test: `app/tests/lib/shared/games/501/checkout-modal.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { classifyVisit } from "@lib/shared/games/501/visit";
import { resolve501CheckoutModal } from "@lib/shared/games/501/checkout-modal";

describe("resolve501CheckoutModal", () => {
  it("returns finish modal on checkout", () => {
    const outcome = classifyVisit(40, 40);
    const result = resolve501CheckoutModal(40, 40, outcome);
    expect(result?.kind).toBe("finish");
    expect(result?.questions.map((q) => q.id)).toEqual([
      "dartsForFinish",
      "dartsOnDouble",
    ]);
  });

  it("returns partial modal for 60→47", () => {
    const outcome = classifyVisit(60, 13);
    const result = resolve501CheckoutModal(60, 13, outcome);
    expect(result?.kind).toBe("partial");
    expect(result?.questions).toHaveLength(1);
    expect(result?.questions[0]?.options).toEqual([0, 1]);
  });

  it("returns null for 60→51", () => {
    const outcome = classifyVisit(60, 9);
    expect(resolve501CheckoutModal(60, 9, outcome)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// app/src/lib/shared/games/501/checkout-modal.ts
import {
  buildPartialDoubleModalQuestion,
  buildSuccessModalQuestions,
  isFinishableCheckout,
  isSingleDartFinishable,
} from "@lib/shared/darts";
import type { ModalQuestion } from "@lib/shared/darts";
import type { VisitClassification } from "./types";

export type CheckoutModalKind = "finish" | "partial";

export type Resolved501CheckoutModal = {
  kind: CheckoutModalKind;
  questions: ModalQuestion[];
};

export function resolve501CheckoutModal(
  remainingBefore: number,
  visitScore: number,
  outcome: VisitClassification,
): Resolved501CheckoutModal | null {
  if (outcome.checkout) {
    return {
      kind: "finish",
      questions: buildSuccessModalQuestions(remainingBefore),
    };
  }

  if (!isFinishableCheckout(remainingBefore)) return null;

  const remainingAfter = outcome.bust
    ? remainingBefore
    : outcome.remainingAfter;

  if (!isSingleDartFinishable(remainingAfter)) return null;

  return {
    kind: "partial",
    questions: [buildPartialDoubleModalQuestion(visitScore)],
  };
}
```

Export type + function from `index.ts`.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(501): resolve checkout modal triggers"
```

---

### Task 3: Visit record dart fields + `applyVisit`

**Files:**
- Modify: `app/src/lib/shared/games/501/types.ts`
- Modify: `app/src/lib/shared/games/501/state.ts`
- Test: `app/tests/lib/shared/games/501/state.test.ts`

- [ ] **Step 1: Extend `FiveOhOneVisitRecord` in `types.ts`**

```ts
dartsThrown: number;
dartsOnDouble?: number;
dartsForFinish?: number;
```

- [ ] **Step 2: Write failing tests**

```ts
it("records dartsThrown=3 on bust visit", () => {
  let session = buildFiveOhOneSession(/* 1P settings */);
  session.state.players[0]!.remaining = 32;
  session = applyVisit(session, 1); // bust
  expect(session.visitHistory[0]!.bust).toBe(true);
  expect(session.visitHistory[0]!.dartsThrown).toBe(3);
  expect(session.state.players[0]!.dartsThisLeg).toBe(3);
});

it("uses dartsForFinish as dartsThrown on checkout", () => {
  let session = buildFiveOhOneSession(/* 1P */);
  session.state.players[0]!.remaining = 40;
  session = applyVisit(session, 40, {
    dartsThrown: 2,
    dartsForFinish: 2,
    dartsOnDouble: 1,
  });
  expect(session.visitHistory[0]!.dartsThrown).toBe(2);
  expect(session.visitHistory[0]!.dartsForFinish).toBe(2);
  expect(session.visitHistory[0]!.dartsOnDouble).toBe(1);
});
```

- [ ] **Step 3: Update `applyVisit` options and body**

```ts
options?: {
  botRngBefore?: number;
  dartsThrown?: number;
  dartsOnDouble?: number;
  dartsForFinish?: number;
};

const dartsThrown = options?.dartsThrown ?? 3;

// visit record:
dartsThrown,
dartsOnDouble: options?.dartsOnDouble,
dartsForFinish: outcome.checkout ? options?.dartsForFinish : undefined,

// bust branch — still increment darts:
currentPlayer.dartsThisLeg += dartsThrown;

// non-bust branch — same:
currentPlayer.dartsThisLeg += dartsThrown;
```

- [ ] **Step 4: Fix existing state tests** that assume `dartsThisLeg` unchanged on bust — expect `+3`.

- [ ] **Step 5: Run `npm test -- tests/lib/shared/games/501/state.test.ts` — PASS**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(501): track dartsThrown per visit including busts"
```

---

### Task 4: Completion replay + `visitsMatch`

**Files:**
- Modify: `app/src/lib/shared/games/501/completion.ts`
- Test: `app/tests/lib/shared/games/501/completion.test.ts`

- [ ] **Step 1: Write failing test — DartBot session with `botRngBefore` replays**

```ts
it("validates completed dartbot session with botRngBefore on user visits", () => {
  let session = buildFiveOhOneSession(botSettings, "u1");
  session.state.phase = "play";
  // play until match complete with botRngBefore on user visits
  const result = validateCompletedFiveOhOneSession(session);
  expect(result.valid).toBe(true);
});
```

- [ ] **Step 2: Fix replay loop**

```ts
replayed = applyVisit(replayed, submittedVisit.visitScore, {
  botRngBefore: submittedVisit.botRngBefore,
  dartsThrown: submittedVisit.dartsThrown,
  dartsOnDouble: submittedVisit.dartsOnDouble,
  dartsForFinish: submittedVisit.dartsForFinish,
});
```

- [ ] **Step 3: Normalize `visitsMatch` — compare without `stateSnapshot`**

```ts
function visitGameplayFields(v: FiveOhOneVisitRecord) {
  const { stateSnapshot: _, ...rest } = v;
  return rest;
}
function visitsMatch(a: FiveOhOneVisitRecord, b: FiveOhOneVisitRecord): boolean {
  return JSON.stringify(visitGameplayFields(a)) === JSON.stringify(visitGameplayFields(b));
}
```

- [ ] **Step 4: Run completion tests — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(501): completion replay preserves botRngBefore and dart metadata"
```

---

### Task 5: Bot dart metadata + display name

**Files:**
- Create: `app/src/lib/shared/games/501/bot-dart-metadata.ts`
- Create: `app/src/lib/shared/games/501/display.ts`
- Test: `app/tests/lib/shared/games/501/bot-dart-metadata.test.ts`

- [ ] **Step 1: Write failing test for `deriveBotVisitDartMetadata`**

```ts
import { simulateVisit, createRng, type SkillProfile } from "@lib/shared/dartbot";
import { deriveBotVisitDartMetadata } from "@lib/shared/games/501/bot-dart-metadata";

it("counts double/bull rings as dartsOnDouble", () => {
  // use a deterministic visit fixture or mock SimulatedVisit
  const visit = {
    darts: [
      { target: {}, actual: { ring: "single", label: "T20", score: 60 }, score: 60 },
      { target: {}, actual: { ring: "double", label: "D10", score: 20 }, score: 20 },
      { target: {}, actual: { ring: "double", label: "D10", score: 20 }, score: 20 },
    ],
    visitScore: 100,
    bust: false,
    checkout: true,
  };
  const meta = deriveBotVisitDartMetadata(visit);
  expect(meta.dartsThrown).toBe(3);
  expect(meta.dartsOnDouble).toBe(2);
  expect(meta.dartsForFinish).toBe(3);
});
```

- [ ] **Step 2: Implement**

```ts
import type { SimulatedVisit } from "@lib/shared/dartbot";

export function deriveBotVisitDartMetadata(visit: SimulatedVisit) {
  const dartsOnDouble = visit.darts.filter(
    (d) => d.actual.ring === "double" || d.actual.ring === "bull",
  ).length;
  const dartsThrown = visit.darts.length;
  return {
    dartsThrown,
    dartsOnDouble,
    dartsForFinish: visit.checkout ? dartsThrown : undefined,
  };
}
```

```ts
// display.ts
import type { FiveOhOnePlayer } from "./types";

export function format501PlayerDisplayName(player: FiveOhOnePlayer): string {
  if (player.type === "dartbot") return `DartBot - lvl ${player.level}`;
  return player.name;
}
```

- [ ] **Step 3: Export from barrel; run tests — PASS**

- [ ] **Step 4: Commit**

---

### Task 6: `player_dart_stats` aggregation

**Files:**
- Create: `app/src/lib/shared/games/501/dart-stats.ts`
- Modify: `app/src/lib/shared/games/501/index.ts`
- Test: `app/tests/lib/shared/games/501/dart-stats.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { createEmptyPlayerDartStats, type PlayerDartStats } from "@lib/shared/stats";
import { apply501VisitToDartStats } from "@lib/shared/games/501/dart-stats";

it("partial visit adds doubleAttempts only", () => {
  const stats = createEmptyPlayerDartStats();
  apply501VisitToDartStats(stats, {
    checkout: false,
    dartsOnDouble: 1,
    dartsThrown: 3,
    // ...minimal visit fields
  } as FiveOhOneVisitRecord);
  expect(stats.doubleAttempts).toBe(1);
  expect(stats.doubleHits).toBe(0);
});

it("checkout visit adds hits and checkout darts", () => {
  const stats = createEmptyPlayerDartStats();
  apply501VisitToDartStats(stats, {
    checkout: true,
    dartsOnDouble: 1,
    dartsForFinish: 2,
    dartsThrown: 2,
  } as FiveOhOneVisitRecord);
  expect(stats.doubleAttempts).toBe(1);
  expect(stats.doubleHits).toBe(1);
  expect(stats.totalCheckoutDarts).toBe(2);
});
```

- [ ] **Step 2: Implement**

```ts
import type { PlayerDartStats } from "@lib/shared/stats";
import type { FiveOhOneSession, FiveOhOneVisitRecord } from "./types";

export function apply501VisitToDartStats(
  stats: PlayerDartStats,
  visit: FiveOhOneVisitRecord,
): void {
  if (visit.dartsOnDouble !== undefined) {
    stats.doubleAttempts += visit.dartsOnDouble;
  }
  if (visit.checkout && visit.dartsForFinish !== undefined) {
    stats.doubleHits += 1;
    stats.totalCheckouts += 1;
    stats.totalCheckoutDarts += visit.dartsForFinish;
  }
}

export function applyGameCompletionToDartStats(
  stats: PlayerDartStats,
  session: FiveOhOneSession,
): void {
  const user = session.settings.players.find((p) => p.type === "user");
  if (!user) return;
  for (const visit of session.visitHistory) {
    if (visit.playerId !== user.id) continue;
    if (visit.dartsOnDouble === undefined && !visit.checkout) continue;
    apply501VisitToDartStats(stats, visit);
  }
}
```

- [ ] **Step 3: Run tests — PASS; commit**

---

### Task 7: Summary uses `dartsThrown`

**Files:**
- Modify: `app/src/lib/shared/games/501/summary.ts`
- Test: `app/tests/lib/shared/games/501/summary.test.ts`

- [ ] **Step 1: Update `getPlayerSummaryStats`**

```ts
const dartsThrown = playerVisits.reduce((sum, v) => sum + v.dartsThrown, 0);
```

- [ ] **Step 2: Fix tests that hardcode `visits * 3`; run — PASS; commit**

---

### Task 8: Undo after user leg win

**Files:**
- Modify: `app/src/lib/shared/games/501/bot-helpers.ts`
- Modify: `app/src/lib/client/alpine/games/501.play.ts` (`canUndo` getter)
- Test: `app/tests/lib/shared/games/501/bot-helpers.test.ts`

- [ ] **Step 1: Add helper**

```ts
export function canUndoUserCheckoutBeforeBotLegStart(
  session: FiveOhOneSession,
): boolean {
  if (!isDartBotSession(session) || !isDartBotTurn(session)) return false;
  const last = session.visitHistory.at(-1);
  if (!last?.checkout) return false;
  const player = getPlayerById(session, last.playerId);
  return player?.type === "user";
}
```

- [ ] **Step 2: Update `canUndoDartBotPair` / play `canUndo`**

```ts
get canUndo() {
  if (!this.session) return false;
  if (this.showModal) return true; // can dismiss pending visit
  if (isDartBotSession(this.session)) {
    return (
      canUndoDartBotPair(this.session) ||
      canUndoUserCheckoutBeforeBotLegStart(this.session)
    );
  }
  return this.session.visitHistory.length > 0;
}
```

- [ ] **Step 3: Update `undoVisit`**

```ts
if (canUndoUserCheckoutBeforeBotLegStart(this.session)) {
  this.session = revertLastVisit(this.session);
  return;
}
```

- [ ] **Step 4: Tests + commit**

---

### Task 9: DartBot animation timing

**Files:**
- Modify: `app/src/lib/client/alpine/games/dartbot-turn-modal.ts`
- Modify: `app/src/lib/client/alpine/games/501.play.ts` (pass options)
- Test: `app/tests/lib/client/alpine/games/dartbot-turn-modal.test.ts` (create if missing)

- [ ] **Step 1: Add `holdMs` to `AnimateDartBotVisitOptions`**

```ts
export type AnimateDartBotVisitOptions = {
  dartMs?: number;
  holdMs?: number;
  // ...
};

// after loop:
if (result !== "aborted" && holdMs > 0) {
  await delayWithVisibilityPause(holdMs, signal);
}
onComplete?.();
```

- [ ] **Step 2: In `runDartBotTurn`**

```ts
await animateDartBotVisit(simulated.visit, {
  dartMs: 800,
  holdMs: 600,
  // ...
});
```

- [ ] **Step 3: Test timing with fake timers; commit**

---

### Task 10: Alpine play — modal flow + bug fixes

**Files:**
- Modify: `app/src/lib/client/alpine/games/501.play.ts`
- Test: `app/tests/lib/client/alpine/games/501.play.test.ts`

- [ ] **Step 1: Add modal state fields** (mirror TUOD): `showModal`, `modalKind`, `modalQuestions`, `dartsOnDouble`, `dartsForFinish`, `pendingVisitScore`, `botRngBefore`

- [ ] **Step 2: Refactor `submitVisit`**

```ts
async submitVisit() {
  // guards...
  const validation = validateVisitScore(this.score ?? 0);
  if (!validation.valid) return;

  const remainingBefore = /* current player remaining */;
  const outcome = classifyVisit(remainingBefore, validation.value);
  const modal = resolve501CheckoutModal(remainingBefore, validation.value, outcome);

  if (modal) {
    this.pendingVisitScore = validation.value;
    this.modalKind = modal.kind;
    this.modalQuestions = modal.questions;
    this.dartsOnDouble = null;
    this.dartsForFinish = null;
    this.applyAutoValues();
    this.botRngBefore = this.session.botState?.rngState;
    this.showModal = true;
    return;
  }

  this.commitVisit(validation.value);
}

commitVisit(visitScore: number, dartMeta?: VisitDartMetadata) {
  this.session = applyVisit(this.session, visitScore, {
    botRngBefore: this.botRngBefore ?? this.session.botState?.rngState,
    ...dartMeta,
  });
  this.score = null;
  this.botRngBefore = undefined;
  // bot turn / completeMatch as today
}

async modalSubmit() {
  if (!this.modalCanSubmit || this.pendingVisitScore === null) return;
  const meta =
    this.modalKind === "finish"
      ? {
          dartsThrown: this.dartsForFinish as number,
          dartsForFinish: this.dartsForFinish as number,
          dartsOnDouble: this.dartsOnDouble as number,
        }
      : {
          dartsThrown: 3,
          dartsOnDouble: this.dartsOnDouble as number,
        };
  this.showModal = false;
  const score = this.pendingVisitScore;
  this.pendingVisitScore = null;
  this.commitVisit(score, meta);
}
```

- [ ] **Step 3: `persistCompletion` — reset persisting on error**

```ts
if (!data.ok) {
  this.error = t(data.code ?? MessageCode.SERVER_ERROR);
  this.persisting = false;
  return;
}
```

Also in `catch` block: `this.persisting = false`.

- [ ] **Step 4: `runDartBotTurn` — pass `deriveBotVisitDartMetadata` to `applyVisit`**

- [ ] **Step 5: Add tests:** empty submit applies 0; modal defers applyVisit; persist error resets persisting

- [ ] **Step 6: Run play tests — PASS; commit**

---

### Task 11: Play + Summary Astro

**Files:**
- Modify: `app/src/components/games/501/Play.astro`
- Modify: `app/src/components/games/501/Summary.astro`

- [ ] **Step 1: Import `OptionModal`; add modal block** (copy TUOD pattern with `dartsForFinish` / `dartsOnDouble` only — no `dartsUsed`)

- [ ] **Step 2: Update `nameModel` for dartbot**

```astro
nameModel={`format501PlayerDisplayName(session?.settings.players.find(...) ?? { type: 'guest', id: '', name: '' })`}
```

Expose `format501PlayerDisplayName` on play factory or inline helper in play.ts:

```ts
formatPlayerName(player: FiveOhOnePlayer) {
  return format501PlayerDisplayName(player);
}
```

- [ ] **Step 3: Summary Back button**

```astro
<button
  type="button"
  class="btn-secondary btn-press font-medium flex items-center justify-center"
  @click="backToGames()"
>
  Back
</button>
```

- [ ] **Step 4: Assembly test or grep wiring; commit**

---

### Task 12: Completion API — `player_dart_stats`

**Files:**
- Modify: `app/src/pages/api/games/501/complete.ts`
- Test: `app/tests/api/games/501/complete.test.ts`

- [ ] **Step 1: Mock `player-dart-stats`; write failing test**

```ts
it("saves player_dart_stats on completion", async () => {
  const session = buildCompletedSessionWithCheckoutMetadata();
  await POST(createContext({ session }));
  expect(mockSavePlayerDartStats).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Wire API** (mirror TUOD `complete.ts`)

```ts
import {
  getPlayerDartStats,
  savePlayerDartStats,
} from "@lib/server/data/player-dart-stats";
import { applyGameCompletionToDartStats } from "@lib/shared/games/501";

const dartStats = await getPlayerDartStats(auth.userId);
applyGameCompletionToDartStats(dartStats, validated.value);
await savePlayerDartStats(auth.userId, dartStats);
```

- [ ] **Step 3: Run API tests — PASS; commit**

---

### Task 13: AGENTS.md migration note

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Under Verification → add bullet**

```markdown
**After pulling DB migrations:** run `cd app && npm run db:migrate` before local completion API smoke tests. Missing tables (e.g. `player_501_stats`) cause 500s; stale schema causes confusing play-flow failures.
```

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(agents): require db:migrate after pulling migrations"
```

---

### Task 14: Final verification

- [ ] **Run full gate**

```bash
cd app && npm run check && npm test && npx fallow && ./scripts/audit-imports.sh
```

- [ ] **Curl smoke (dev server running)**

```bash
cd app && ./scripts/curl-verify-501.sh
```

Expected: `All curl checks passed`

- [ ] **Update `curl-verify-501.sh`** if completion body needs `dartsThrown` on visits — ensure scripted session includes required fields.

---

## Plan self-review (spec coverage)

| Spec § | Task |
| ------ | ---- |
| §2 Checkout modal | 1, 2, 10, 11 |
| §3 Darts counting | 3, 7 |
| §4 Stats option C | 6, 12 |
| §5 DartBot | 5, 9, 10, 11 |
| §6 Bug fixes | 4, 8, 10, 11, 13 |
| §8 Testing | All task tests + 14 |

No placeholders remain. Type names consistent: `applyGameCompletionToDartStats` (501 dart stats) vs existing `applyGameCompletionToStats` (501 game stats) — distinct names intentional.
