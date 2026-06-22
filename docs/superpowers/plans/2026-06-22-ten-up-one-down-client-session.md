# Ten Up One Down Client Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate ten-up-one-down active session DB usage; hold in-game state in Alpine `$persist`; validate settings via form POST; apply rounds/undo locally; persist player dart stats and play count only on completion; show Summary panel with skeleton during completion API; client-side play again.

**Architecture:** Shared helpers parse form data, build initial session, build summary, validate terminal sessions, and batch-apply stats. Play page handles POST for TUOD start. In-progress state held in Alpine `$persist(...).using(sessionStorage)`. Alpine play controller applies rounds locally after OptionModal (preserved); `ready` gate and skeleton placeholders mirror score/singles. Single `/api/games/ten-up-one-down/complete` endpoint writes stats + play count. Settings use native form POST (no resume/abandon banner).

**Tech Stack:** Astro 6, Alpine.js 3, `@alpinejs/persist`, TypeScript, Vitest, Drizzle/Neon Postgres

**Spec:** `docs/superpowers/specs/2026-06-22-ten-up-one-down-client-session-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

---

## Verification Gate (every task)

```bash
cd app && npm run check && npm test && npx fallow
```

Required:

- `npm run check` → 0 errors / 0 warnings / 0 hints
- `npm test` → exit 0, 0 failures
- `npx fallow` → exit 0 (verify findings before removing; see Final Verification Gate)

---

## File Structure Overview

| File | Responsibility |
| ---- | -------------- |
| `src/lib/shared/games/ten-up-one-down/form-data.ts` | Parse settings FormData → validation input |
| `src/lib/shared/games/ten-up-one-down/session-factory.ts` | Build in-memory session from validated settings |
| `src/lib/shared/games/ten-up-one-down/summary.ts` | `TenUpOneDownSummary` + `buildSummary()` |
| `src/lib/shared/games/ten-up-one-down/stats.ts` | `applyGameCompletionToStats()` — batch `applyRoundToStats` |
| `src/lib/shared/games/ten-up-one-down/completion.ts` | Validate terminal session payload for API |
| `src/pages/api/games/ten-up-one-down/complete.ts` | Sole DB write endpoint (stats + play count) |
| `src/pages/games/[game].astro` | POST handler for TUOD; remove DB session load |
| `src/pages/games/settings-[game].astro` | Remove TUOD active session lookup |
| `src/components/games/ten-up-one-down/TenUpOneDownSettingsShell.astro` | Native form POST; remove resume/abandon |
| `src/lib/client/alpine/games/ten-up-one-down.settings.ts` | Simplify to `endMode` only (like score training) |
| `src/lib/client/alpine/games/ten-up-one-down.play.ts` | `$persist` session; local modalSubmit/undo; completion API; play again |
| `src/components/games/ten-up-one-down/PlayShellSkeleton.astro` | Play chrome placeholder until `ready` |
| `src/components/games/ten-up-one-down/SummarySkeleton.astro` | Summary placeholder during completion API |
| `src/components/games/ten-up-one-down/Summary.astro` | End-of-game stats + play again |
| `src/components/games/ten-up-one-down/Play.astro` | Skeleton/live swap; wire Summary |
| `src/lib/shared/api/types.ts` | Add `TenUpOneDownCompleteSuccess` |

**Delete:**

| File | Reason |
| ---- | ------ |
| `src/pages/api/games/ten-up-one-down/session.ts` | No active session CRUD |
| `src/pages/api/games/ten-up-one-down/session/round.ts` | Rounds are client-side |
| `src/pages/api/games/ten-up-one-down/session/round/last.ts` | Undo is client-side |
| `src/lib/server/data/ten-up-one-down-session.ts` | No active session storage |
| `tests/lib/server/data/ten-up-one-down-session.test.ts` | Data layer removed |
| `tests/api/games/ten-up-one-down/session.test.ts` | Route removed |
| `tests/api/games/ten-up-one-down/round.test.ts` | Route removed |
| `tests/api/games/ten-up-one-down/round-last.test.ts` | Route removed |

---

## Data Flow

```
modalSubmit (after OptionModal)
  → buildRoundRecord → roundHistory.push → applyRoundToState locally
  → if terminal: showSummary = true, summary = null → persistCompletion()

persistCompletion()
  → POST /api/games/ten-up-one-down/complete
      → validate + save dart stats + increment play count
      → summary populated, persist cleared

playAgain()
  → buildTenUpOneDownSession(session.settings) — no API
```

---

### Task 1: Shared Form Data Parser

**Files:**
- Create: `app/src/lib/shared/games/ten-up-one-down/form-data.ts`
- Test: `app/tests/lib/shared/games/ten-up-one-down/form-data.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/ten-up-one-down/form-data.test.ts
import { describe, it, expect } from "vitest";
import { parseTenUpOneDownSettingsFormData } from "@lib/shared/games/ten-up-one-down/form-data";

describe("parseTenUpOneDownSettingsFormData", () => {
  it("maps endMode and roundCount from form fields", () => {
    const formData = new FormData();
    formData.set("endMode", "rounds");
    formData.set("roundCount", "10");

    expect(parseTenUpOneDownSettingsFormData(formData)).toEqual({
      endMode: "rounds",
      roundCount: 10,
    });
  });

  it("converts playtime minutes to seconds", () => {
    const formData = new FormData();
    formData.set("endMode", "timed");
    formData.set("playtimeMinutes", "10");

    expect(parseTenUpOneDownSettingsFormData(formData)).toEqual({
      endMode: "timed",
      playtimeSeconds: 600,
    });
  });

  it("returns empty object for empty form", () => {
    expect(parseTenUpOneDownSettingsFormData(new FormData())).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/form-data.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/games/ten-up-one-down/form-data.ts

/**
 * Converts ten-up-one-down settings form fields to validation input.
 */
export function parseTenUpOneDownSettingsFormData(
  formData: FormData,
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;

    if (key === "roundCount") {
      settings[key] = Number(value);
      continue;
    }

    if (key === "playtimeMinutes") {
      settings.playtimeSeconds = Number(value) * 60;
      continue;
    }

    settings[key] = value;
  }

  return settings;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/form-data.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 2: Session Factory

**Files:**
- Create: `app/src/lib/shared/games/ten-up-one-down/session-factory.ts`
- Test: `app/tests/lib/shared/games/ten-up-one-down/session-factory.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/ten-up-one-down/session-factory.test.ts
import { describe, it, expect } from "vitest";
import { buildTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session-factory";
import { STARTING_TARGET } from "@lib/shared/games/ten-up-one-down/constants";

describe("buildTenUpOneDownSession", () => {
  it("creates an active rounds session", () => {
    const session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 10 });

    expect(session.slug).toBe("ten-up-one-down");
    expect(session.state.status).toBe("active");
    expect(session.state.currentRound).toBe(1);
    expect(session.state.currentTarget).toBe(STARTING_TARGET);
    expect(session.roundHistory).toEqual([]);
    expect(session.timeRemainingSeconds).toBeNull();
    expect(session.createdAt).toMatch(/^\d{4}-/);
    expect(session.updatedAt).toMatch(/^\d{4}-/);
  });

  it("sets timeRemainingSeconds for timed mode", () => {
    const session = buildTenUpOneDownSession({
      endMode: "timed",
      playtimeSeconds: 600,
    });
    expect(session.timeRemainingSeconds).toBe(600);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/session-factory.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/games/ten-up-one-down/session-factory.ts
import { createInitialGameState } from "@lib/shared/games/ten-up-one-down/state";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";
import type { TenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/settings";

/**
 * Builds an in-memory ten-up-one-down session from validated settings.
 */
export function buildTenUpOneDownSession(
  settings: TenUpOneDownSettings,
): TenUpOneDownSession {
  const now = new Date().toISOString();

  return {
    slug: "ten-up-one-down",
    settings,
    state: createInitialGameState(settings),
    roundHistory: [],
    timeRemainingSeconds:
      settings.endMode === "timed" ? settings.playtimeSeconds : null,
    createdAt: now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/session-factory.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 3: Summary Builder

**Files:**
- Create: `app/src/lib/shared/games/ten-up-one-down/summary.ts`
- Test: `app/tests/lib/shared/games/ten-up-one-down/summary.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/ten-up-one-down/summary.test.ts
import { describe, it, expect } from "vitest";
import { buildSummary } from "@lib/shared/games/ten-up-one-down/summary";
import { buildTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session-factory";
import { applyRoundToState } from "@lib/shared/games/ten-up-one-down/state";
import { buildRoundRecord } from "@lib/shared/games/ten-up-one-down/round";
import { MAX_TARGET } from "@lib/shared/games/ten-up-one-down/constants";

describe("buildSummary", () => {
  it("computes session aggregates and peak target across progression", () => {
    let session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 10 });
    const round = buildRoundRecord(1, 41, {
      outcome: "success",
      dartsForFinish: 2,
      dartsOnDouble: 1,
    });
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);

    const summary = buildSummary(session);
    expect(summary.roundsPlayed).toBe(1);
    expect(summary.checkouts).toBe(1);
    expect(summary.doubleHitPercentage).toBeCloseTo(100);
    expect(summary.finalTarget).toBe(51);
    expect(summary.peakTarget).toBe(51);
    expect(summary.completionReason).toBe("rounds");
  });

  it("uses checkout170 completion reason when finishing at max target", () => {
    let session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 10 });
    const round = buildRoundRecord(1, MAX_TARGET, {
      outcome: "success",
      dartsForFinish: 3,
      dartsOnDouble: 1,
    });
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);

    const summary = buildSummary(session);
    expect(summary.completionReason).toBe("checkout170");
    expect(summary.peakTarget).toBe(MAX_TARGET);
  });

  it("uses timed completion reason for timed sessions", () => {
    let session = buildTenUpOneDownSession({
      endMode: "timed",
      playtimeSeconds: 60,
    });
    session.timeRemainingSeconds = 0;
    session.state.status = "completed";
    const round = buildRoundRecord(1, 41, {
      outcome: "failure",
      dartsUsed: 3,
      dartsOnDouble: 0,
    });
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);

    const summary = buildSummary(session);
    expect(summary.completionReason).toBe("timed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/summary.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/games/ten-up-one-down/summary.ts
import { MAX_TARGET } from "@lib/shared/games/ten-up-one-down/constants";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";

export type TenUpOneDownCompletionReason = "checkout170" | "rounds" | "timed";

export type TenUpOneDownSummary = {
  completionReason: TenUpOneDownCompletionReason;
  roundsPlayed: number;
  checkouts: number;
  doubleHitPercentage: number;
  finalTarget: number;
  peakTarget: number;
};

/**
 * Builds end-of-game summary stats from a completed session.
 */
export function buildSummary(session: TenUpOneDownSession): TenUpOneDownSummary {
  const roundsPlayed = session.roundHistory.length;
  const checkouts = session.roundHistory.filter((round) => round.finished).length;
  const doubleAttempts = session.roundHistory.reduce(
    (sum, round) => sum + round.dartsOnDouble,
    0,
  );
  const doubleHitPercentage =
    doubleAttempts === 0 ? 0 : (checkouts / doubleAttempts) * 100;

  let peakTarget = session.state.currentTarget;
  for (const round of session.roundHistory) {
    peakTarget = Math.max(peakTarget, round.targetAtStart, round.targetAfter);
  }

  const lastRound = session.roundHistory[session.roundHistory.length - 1];
  let completionReason: TenUpOneDownCompletionReason = "rounds";
  if (lastRound?.finished && lastRound.targetAtStart === MAX_TARGET) {
    completionReason = "checkout170";
  } else if (session.settings.endMode === "timed") {
    completionReason = "timed";
  }

  return {
    completionReason,
    roundsPlayed,
    checkouts,
    doubleHitPercentage,
    finalTarget: session.state.currentTarget,
    peakTarget,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/summary.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 4: Completion Stats Helper

**Files:**
- Create: `app/src/lib/shared/games/ten-up-one-down/stats.ts`
- Test: `app/tests/lib/shared/games/ten-up-one-down/stats.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/ten-up-one-down/stats.test.ts
import { describe, it, expect } from "vitest";
import { applyGameCompletionToStats } from "@lib/shared/games/ten-up-one-down/stats";
import { createEmptyPlayerDartStats } from "@lib/shared/stats/double-stats";
import { buildTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session-factory";
import { applyRoundToState } from "@lib/shared/games/ten-up-one-down/state";
import { buildRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

describe("applyGameCompletionToStats", () => {
  it("applies all rounds from session to player dart stats", () => {
    let session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 2 });
    const success = buildRoundRecord(1, 41, {
      outcome: "success",
      dartsForFinish: 2,
      dartsOnDouble: 1,
    });
    session.state = applyRoundToState(session.state, success, session.settings);
    session.roundHistory.push(success);

    const failure = buildRoundRecord(2, session.state.currentTarget, {
      outcome: "failure",
      dartsUsed: 3,
      dartsOnDouble: 2,
    });
    session.state = applyRoundToState(session.state, failure, session.settings);
    session.roundHistory.push(failure);

    const stats = createEmptyPlayerDartStats();
    applyGameCompletionToStats(stats, session);

    expect(stats.doubleAttempts).toBe(3);
    expect(stats.doubleHits).toBe(1);
    expect(stats.totalCheckouts).toBe(1);
    expect(stats.totalCheckoutDarts).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/stats.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/games/ten-up-one-down/stats.ts
import { applyRoundToStats } from "@lib/shared/stats/double-stats";
import type { PlayerDartStats } from "@lib/shared/stats/types";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";

/**
 * Applies all rounds from a completed session to aggregate player dart stats.
 */
export function applyGameCompletionToStats(
  stats: PlayerDartStats,
  session: TenUpOneDownSession,
): void {
  for (const round of session.roundHistory) {
    applyRoundToStats(stats, round);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/stats.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 5: Completion Validator

**Files:**
- Create: `app/src/lib/shared/games/ten-up-one-down/completion.ts`
- Test: `app/tests/lib/shared/games/ten-up-one-down/completion.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/ten-up-one-down/completion.test.ts
import { describe, it, expect } from "vitest";
import { validateCompletedTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/completion";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { buildTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session-factory";
import { applyRoundToState } from "@lib/shared/games/ten-up-one-down/state";
import { buildRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

function buildCompletedRoundsSession(roundCount = 2) {
  let session = buildTenUpOneDownSession({ endMode: "rounds", roundCount });
  for (let i = 0; i < roundCount; i++) {
    const round = buildRoundRecord(session.state.currentRound, session.state.currentTarget, {
      outcome: "failure",
      dartsUsed: 3,
      dartsOnDouble: 0,
    });
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);
  }
  return session;
}

describe("validateCompletedTenUpOneDownSession", () => {
  it("accepts a legitimately completed rounds session", () => {
    const session = buildCompletedRoundsSession(2);
    const result = validateCompletedTenUpOneDownSession(session);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value.state.status).toBe("completed");
  });

  it("rejects incomplete session", () => {
    const session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 10 });
    const result = validateCompletedTenUpOneDownSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.GAME_NOT_COMPLETE });
  });

  it("rejects tampered targetAfter", () => {
    const session = buildCompletedRoundsSession(1);
    session.roundHistory[0] = { ...session.roundHistory[0]!, targetAfter: 999 };
    const result = validateCompletedTenUpOneDownSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_ROUND });
  });

  it("rejects invalid shape", () => {
    const result = validateCompletedTenUpOneDownSession({ slug: "501" });
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/completion.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/games/ten-up-one-down/completion.ts
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { MAX_TARGET } from "@lib/shared/games/ten-up-one-down/constants";
import { validateRoundRecord } from "@lib/shared/games/ten-up-one-down/round";
import {
  isTenUpOneDownSession,
  type TenUpOneDownSession,
} from "@lib/shared/games/ten-up-one-down/session";
import { createInitialGameState, applyRoundToState } from "@lib/shared/games/ten-up-one-down/state";
import { validateTenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/validation";

export type ValidateCompletedResult =
  | { valid: true; value: TenUpOneDownSession }
  | {
      valid: false;
      code:
        | typeof MessageCode.INVALID_GAME_SETTINGS
        | typeof MessageCode.GAME_NOT_COMPLETE
        | typeof MessageCode.INVALID_ROUND;
    };

/**
 * Validates a client-submitted completed ten-up-one-down session.
 */
export function validateCompletedTenUpOneDownSession(
  raw: unknown,
): ValidateCompletedResult {
  if (!isTenUpOneDownSession(raw)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  const session = raw;
  const settingsCheck = validateTenUpOneDownSettings(
    session.settings as unknown as Record<string, unknown>,
  );
  if (!settingsCheck.valid) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  if (session.state.status !== "completed") {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  if (session.roundHistory.length < 1) {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  let replayState = createInitialGameState(settingsCheck.value);

  for (const round of session.roundHistory) {
    if (round.roundNumber !== replayState.currentRound) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }
    if (round.targetAtStart !== replayState.currentTarget) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }

    const roundCheck = validateRoundRecord(round);
    if (!roundCheck.valid) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }

    const roundCopy = { ...round };
    replayState = applyRoundToState(replayState, roundCopy, settingsCheck.value);
    if (roundCopy.targetAfter !== round.targetAfter) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }
  }

  if (
    replayState.currentRound !== session.state.currentRound ||
    replayState.currentTarget !== session.state.currentTarget ||
    replayState.status !== session.state.status
  ) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }

  const lastRound = session.roundHistory[session.roundHistory.length - 1]!;
  const completedOn170 =
    lastRound.finished && lastRound.targetAtStart === MAX_TARGET;

  if (settingsCheck.value.endMode === "rounds") {
    if (
      !completedOn170 &&
      session.roundHistory.length !== settingsCheck.value.roundCount
    ) {
      return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
    }
  } else if (!completedOn170) {
    if (
      session.timeRemainingSeconds === null ||
      session.timeRemainingSeconds > 0
    ) {
      return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
    }
  }

  return { valid: true, value: session };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/ten-up-one-down/completion.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 6: Completion API + API Types

**Files:**
- Create: `app/src/pages/api/games/ten-up-one-down/complete.ts`
- Create: `app/tests/api/games/ten-up-one-down/complete.test.ts`
- Modify: `app/src/lib/shared/api/types.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/api/games/ten-up-one-down/complete.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "@api/games/ten-up-one-down/complete";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { createEmptyPlayerDartStats } from "@lib/shared/stats/double-stats";
import { buildTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session-factory";
import { applyRoundToState } from "@lib/shared/games/ten-up-one-down/state";
import { buildRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

const mockGetSession = vi.fn();
const mockGetPlayerDartStats = vi.fn();
const mockSavePlayerDartStats = vi.fn();
const mockIncrementPlayCount = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/player-dart-stats", () => ({
  getPlayerDartStats: (...args: unknown[]) => mockGetPlayerDartStats(...args),
  savePlayerDartStats: (...args: unknown[]) => mockSavePlayerDartStats(...args),
}));

vi.mock("@lib/server/data/games", () => ({
  incrementPlayCount: (...args: unknown[]) => mockIncrementPlayCount(...args),
}));

function buildCompletedRoundsSession() {
  let session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 2 });
  for (let i = 0; i < 2; i++) {
    const round = buildRoundRecord(session.state.currentRound, session.state.currentTarget, {
      outcome: "failure",
      dartsUsed: 3,
      dartsOnDouble: 0,
    });
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);
  }
  return session;
}

function createContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/games/ten-up-one-down/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/ten-up-one-down/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      isLoggedIn: true,
      userId: "00000000-0000-4000-8000-000000000001",
    });
    mockGetPlayerDartStats.mockResolvedValue(createEmptyPlayerDartStats());
    mockSavePlayerDartStats.mockResolvedValue(undefined);
    mockIncrementPlayCount.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });
    const response = await POST(createContext(buildCompletedRoundsSession()));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("returns 400 for incomplete session", async () => {
    const response = await POST(
      createContext(buildTenUpOneDownSession({ endMode: "rounds", roundCount: 10 })),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.GAME_NOT_COMPLETE,
    });
  });

  it("saves stats, increments play count, and returns summary", async () => {
    const session = buildCompletedRoundsSession();
    const response = await POST(createContext({ session }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.summary).toEqual({
      completionReason: "rounds",
      roundsPlayed: 2,
      checkouts: 0,
      doubleHitPercentage: 0,
      finalTarget: 39,
      peakTarget: 41,
    });
    expect(mockSavePlayerDartStats).toHaveBeenCalledTimes(1);
    expect(mockIncrementPlayCount).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "ten-up-one-down",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/api/games/ten-up-one-down/complete.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Add API type and implement route**

Add to `app/src/lib/shared/api/types.ts`:

```typescript
import type { TenUpOneDownSummary } from "@lib/shared/games/ten-up-one-down/summary";

export type TenUpOneDownCompleteSuccess = {
  ok: true;
  summary: TenUpOneDownSummary;
};
```

Add `TenUpOneDownCompleteSuccess` to the `ApiSuccess` union.

Create `app/src/pages/api/games/ten-up-one-down/complete.ts`:

```typescript
import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { validateCompletedTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/completion";
import { buildSummary } from "@lib/shared/games/ten-up-one-down/summary";
import { applyGameCompletionToStats } from "@lib/shared/games/ten-up-one-down/stats";
import { getSession } from "@lib/server/auth/session";
import { incrementPlayCount } from "@lib/server/data/games";
import {
  getPlayerDartStats,
  savePlayerDartStats,
} from "@lib/server/data/player-dart-stats";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const auth = await getSession(request);
  if (!auth.isLoggedIn || !auth.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const sessionPayload =
    payload && typeof payload === "object" && "session" in payload
      ? (payload as { session: unknown }).session
      : payload;

  const validated = validateCompletedTenUpOneDownSession(sessionPayload);
  if (!validated.valid) {
    return jsonResponse({ ok: false, code: validated.code }, 400);
  }

  try {
    const summary = buildSummary(validated.value);
    const stats = await getPlayerDartStats(auth.userId);
    applyGameCompletionToStats(stats, validated.value);
    await savePlayerDartStats(auth.userId, stats);
    await incrementPlayCount(auth.userId, "ten-up-one-down");
    return jsonResponse({ ok: true, summary }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/api/games/ten-up-one-down/complete.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 7: Play Page + Settings Page Routing

**Files:**
- Modify: `app/src/pages/games/[game].astro`
- Modify: `app/src/pages/games/settings-[game].astro`

- [ ] **Step 1: Update `[game].astro`**

Add imports:

```typescript
import { parseTenUpOneDownSettingsFormData } from "@lib/shared/games/ten-up-one-down/form-data";
import { buildTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session-factory";
import { validateTenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/validation";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";
```

Remove:

```typescript
import { getTenUpOneDownSession } from "@lib/server/data/ten-up-one-down-session";
```

Change play-count guard from:

```typescript
if (session.userId && slug !== "score-training" && slug !== "singles-training") {
```

to:

```typescript
if (
  session.userId &&
  slug !== "score-training" &&
  slug !== "singles-training" &&
  slug !== "ten-up-one-down"
) {
```

Remove the `tenUpOneDownSession` fetch and redirect block. Add POST handler (parallel to score-training):

```typescript
let tenUpOneDownSession: TenUpOneDownSession | null = null;

if (slug === "ten-up-one-down") {
  if (Astro.request.method === "POST") {
    const formData = await Astro.request.formData();
    const parsed = parseTenUpOneDownSettingsFormData(formData);
    const validated = validateTenUpOneDownSettings(parsed);
    if (!validated.valid) {
      return Astro.redirect(`/games/settings-${slug}?error=invalid-settings`);
    }
    tenUpOneDownSession = buildTenUpOneDownSession(validated.value);
  }
}
```

Update render branch:

```astro
{slug === "ten-up-one-down" ? (
  <Play displayName={game.displayName} gameSession={tenUpOneDownSession} />
) : slug === "score-training" ? (
```

- [ ] **Step 2: Update `settings-[game].astro`**

Remove:

```typescript
import { getTenUpOneDownSession } from "@lib/server/data/ten-up-one-down-session";
import { isTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";
```

Remove `hasActiveSession` block for ten-up-one-down:

```typescript
if (slug === "ten-up-one-down" && session.userId) {
  const activeSession = await getTenUpOneDownSession(session.userId);
  hasActiveSession = isTenUpOneDownSession(activeSession);
}
```

Change settings shell usage:

```astro
<TenUpOneDownSettingsShell game={game}>
  <SettingsForm />
</TenUpOneDownSettingsShell>
```

- [ ] **Step 3: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 8: Settings Shell + Settings Alpine

**Files:**
- Modify: `app/src/components/games/ten-up-one-down/TenUpOneDownSettingsShell.astro`
- Modify: `app/src/lib/client/alpine/games/ten-up-one-down.settings.ts`
- Modify: `app/tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts`

- [ ] **Step 1: Replace settings shell with form POST pattern**

Replace `TenUpOneDownSettingsShell.astro` content with:

```astro
---
import PrimaryBtn from "@components/ui/PrimaryBtn.astro";
import { playPath } from "@lib/shared/games/paths";
import type { GameType } from "@lib/shared/games/types";

interface Props {
  game: GameType;
}

const { game } = Astro.props;
const playUrl = playPath(game.slug);
---

<main
  class="mx-auto w-full max-w-2xl p-4 @sm:p-6"
  x-data="tenUpOneDownSettings()"
>
  <form id="game-settings-form" method="POST" action={playUrl} class="space-y-4">
    <slot />
    <PrimaryBtn type="submit" label="Play" />
  </form>
</main>
```

- [ ] **Step 2: Simplify settings Alpine factory**

Replace `ten-up-one-down.settings.ts` with:

```typescript
/**
 * Alpine data factory for Ten Up One Down settings flow.
 */
export function tenUpOneDownSettings() {
  return {
    endMode: "rounds" as "rounds" | "timed",
  };
}
```

- [ ] **Step 3: Update settings test**

Replace `ten-up-one-down.settings.test.ts` with:

```typescript
import { describe, it, expect } from "vitest";
import { tenUpOneDownSettings } from "@lib/client/alpine/games/ten-up-one-down.settings";

describe("tenUpOneDownSettings", () => {
  it("defaults endMode to rounds", () => {
    const component = tenUpOneDownSettings();
    expect(component.endMode).toBe("rounds");
  });
});
```

- [ ] **Step 4: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 9: Refactor Alpine Play Controller

**Files:**
- Modify: `app/src/lib/client/alpine/games/ten-up-one-down.play.ts`
- Modify: `app/tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`

Reference: `app/src/lib/client/alpine/games/score-training.play.ts`

- [ ] **Step 1: Add persist key and clear helper**

```typescript
import { buildTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session-factory";
import { applyRoundToState, revertRoundFromState } from "@lib/shared/games/ten-up-one-down/state";
import type { TenUpOneDownSummary } from "@lib/shared/games/ten-up-one-down/summary";
import { isTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";
import type { TenUpOneDownCompleteSuccess } from "@lib/shared/api/types";

export const TEN_UP_ONE_DOWN_SESSION_KEY = "ten-up-one-down-session";

export function clearPersistedTenUpOneDownSession(): void {
  sessionStorage.removeItem(Alpine.prefixed(TEN_UP_ONE_DOWN_SESSION_KEY));
}
```

- [ ] **Step 2: Change factory signature and state**

Change `tenUpOneDownPlay(initialSession)` → `tenUpOneDownPlay(serverSession: TenUpOneDownSession | null)`.

Add state fields:

```typescript
session: (Alpine as any)
  .$persist(serverSession)
  .as(TEN_UP_ONE_DOWN_SESSION_KEY)
  .using(sessionStorage) as TenUpOneDownSession | null,
ready: false,
showSummary: false,
summary: null as TenUpOneDownSummary | null,
```

Update `controlsDisabled`:

```typescript
get controlsDisabled() {
  return (
    !this.ready ||
    this.loading ||
    this.session?.state.status === "paused" ||
    this.showSummary
  );
},
```

- [ ] **Step 3: Implement `init()`**

```typescript
init() {
  if (serverSession) {
    this.session = serverSession;
  }
  if (
    !isTenUpOneDownSession(this.session) ||
    this.session.state.status === "completed"
  ) {
    window.location.href = "/games/settings-ten-up-one-down";
    return;
  }
  this.ready = true;
  if (this.session.settings.endMode === "timed") {
    this.startTimer();
  }
},
```

- [ ] **Step 4: Update `confirmLeave`**

```typescript
confirmLeave() {
  clearPersistedTenUpOneDownSession();
  window.location.href = "/games";
},
```

- [ ] **Step 5: Refactor `modalSubmit` to apply locally**

Replace fetch block with:

```typescript
async modalSubmit() {
  if (!this.session || !this.modalCanSubmit || this.outcome === null) return;

  const input =
    this.outcome === "success"
      ? {
          outcome: "success" as const,
          dartsForFinish: this.dartsForFinish as 1 | 2 | 3,
          dartsOnDouble: this.dartsOnDouble as 1 | 2 | 3,
        }
      : {
          outcome: "failure" as const,
          dartsUsed: this.dartsUsed as 1 | 2 | 3,
          dartsOnDouble: this.dartsOnDouble as 0 | 1 | 2 | 3,
        };

  const round = buildRoundRecord(
    this.session.state.currentRound,
    this.session.state.currentTarget,
    input,
  );

  const timedModeExpired =
    this.timerExpired ||
    (this.session.settings.endMode === "timed" &&
      this.session.timeRemainingSeconds !== null &&
      this.session.timeRemainingSeconds <= 0);

  this.session.roundHistory = [...this.session.roundHistory, round];
  this.session.state = applyRoundToState(
    this.session.state,
    round,
    this.session.settings,
  );

  if (timedModeExpired) {
    this.session.state = { ...this.session.state, status: "completed" };
  }

  this.score = null;
  this.closeModal();

  if (this.session.state.status === "completed") {
    this.showSummary = true;
    this.stopTimer();
    await this.persistCompletion();
  } else {
    this.timerExpired = false;
  }
},
```

- [ ] **Step 6: Refactor `undo` to apply locally**

```typescript
undo() {
  if (!this.session || this.session.roundHistory.length === 0) return;
  const removedRound =
    this.session.roundHistory[this.session.roundHistory.length - 1]!;
  this.session.roundHistory = this.session.roundHistory.slice(0, -1);
  this.session.state = revertRoundFromState(this.session.state, removedRound);
},
```

- [ ] **Step 7: Add `persistCompletion` and `playAgain`**

```typescript
async persistCompletion() {
  this.loading = true;
  this.error = "";
  try {
    const response = await fetch("/api/games/ten-up-one-down/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: this.session }),
    });
    const data = (await response.json()) as ApiResponse;
    if (!data.ok) {
      this.error = t(data.code ?? MessageCode.SERVER_ERROR);
      return;
    }
    const success = data as TenUpOneDownCompleteSuccess;
    this.summary = success.summary;
    clearPersistedTenUpOneDownSession();
  } catch {
    this.error = t(MessageCode.NETWORK_ERROR);
  } finally {
    this.loading = false;
  }
},

playAgain() {
  if (!this.session || !this.summary) return;

  const settings = this.session.settings;
  this.session = buildTenUpOneDownSession(settings);
  this.showSummary = false;
  this.summary = null;
  this.score = null;
  this.timerExpired = false;
  this.error = "";
  this.closeModal();

  if (this.session.settings.endMode === "timed") {
    this.startTimer();
  } else {
    this.stopTimer();
  }
},
```

- [ ] **Step 8: Add timer expiry completion (mirror score-training)**

Add `timerShouldTick` getter and `completeOnTimerExpiry()`:

```typescript
get timerShouldTick() {
  return (
    this.session?.settings.endMode === "timed" &&
    this.session?.state.status === "active" &&
    this.score === null &&
    !this.showModal &&
    !this.showSummary
  );
},

completeOnTimerExpiry() {
  if (!this.session || this.session.settings.endMode !== "timed") return;
  this.timerExpired = true;
  this.session.state = { ...this.session.state, status: "completed" };
  this.showSummary = true;
  this.stopTimer();
  void this.persistCompletion();
},
```

Update `startTimer` interval (mirror `score-training.play.ts`): decrement while `timerShouldTick`; at zero call `completeOnTimerExpiry()` if `score === null`, else set `timerExpired` and stop.

- [ ] **Step 9: Update play tests**

Replace fetch-based `modalSubmit` / `undo` tests with local state assertions. Add tests for:

- `init()` sets `ready` and redirects when no session
- `modalSubmit` advances target locally without fetch
- terminal round sets `showSummary` and calls completion fetch
- `playAgain` rebuilds session without fetch
- `confirmLeave` clears persist key

Example replacement for modalSubmit test:

```typescript
it("modalSubmit applies round locally without round API", async () => {
  vi.mocked(fetch).mockResolvedValue({
    json: async () => ({
      ok: true,
      summary: {
        completionReason: "checkout170",
        roundsPlayed: 1,
        checkouts: 1,
        doubleHitPercentage: 100,
        finalTarget: 170,
        peakTarget: 170,
      },
    }),
  } as Response);

  const play = tenUpOneDownPlay(structuredClone(roundsSession));
  play.ready = true;
  play.score = "41";
  play.submitScore();
  play.dartsForFinish = 2;
  play.dartsOnDouble = 1;

  await play.modalSubmit();

  expect(fetch).not.toHaveBeenCalledWith(
    "/api/games/ten-up-one-down/session/round",
    expect.anything(),
  );
  expect(play.session?.state.currentTarget).toBe(51);
  expect(play.showModal).toBe(false);
});
```

- [ ] **Step 10: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 10: UI Components (Skeletons, Summary, Play)

**Files:**
- Create: `app/src/components/games/ten-up-one-down/PlayShellSkeleton.astro`
- Create: `app/src/components/games/ten-up-one-down/SummarySkeleton.astro`
- Create: `app/src/components/games/ten-up-one-down/Summary.astro`
- Modify: `app/src/components/games/ten-up-one-down/Play.astro`

- [ ] **Step 1: Create PlayShellSkeleton**

```astro
---
import Skeleton from "@components/ui/Skeleton.astro";
---

<div class="flex flex-col gap-4 flex-1" data-testid="tuod-play-shell-skeleton">
  <Skeleton variant="block" class="h-24 w-full rounded-lg" />
  <Skeleton variant="text" class="h-4 w-32 mx-auto" />
  <article class="game-panel p-4 flex flex-col gap-2 flex-1">
    <Skeleton variant="block" class="h-12 w-full" />
    <Skeleton variant="block" class="h-12 w-full" />
    <Skeleton variant="block" class="h-12 w-full" />
  </article>
</div>
```

- [ ] **Step 2: Create SummarySkeleton**

```astro
---
import Skeleton from "@components/ui/Skeleton.astro";
---

<article class="game-panel p-6 flex flex-col gap-4" data-testid="tuod-summary-skeleton">
  <Skeleton variant="bar" class="h-6 w-40" />
  <dl class="grid grid-cols-2 gap-3">
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
  </dl>
  <Skeleton variant="text" class="h-4 w-56" />
  <div class="grid grid-cols-2 gap-2">
    <Skeleton variant="block" class="h-10 rounded-full" />
    <Skeleton variant="block" class="h-10 rounded-full" />
  </div>
</article>
```

- [ ] **Step 3: Create Summary.astro**

```astro
---
import SummaryStatRow from "../SummaryStatRow.astro";

interface Props {
  showSummaryModel?: string;
  summaryModel?: string;
  loadingModel?: string;
}

const {
  showSummaryModel = "showSummary",
  summaryModel = "summary",
  loadingModel = "loading",
} = Astro.props;

const summary = {
  "Rounds played": `${summaryModel}?.roundsPlayed ?? 0`,
  Checkouts: `${summaryModel}?.checkouts ?? 0`,
  "Double-hit %": `((${summaryModel}?.doubleHitPercentage ?? 0).toFixed(1) + '%')`,
  "Final target": `${summaryModel}?.finalTarget ?? 0`,
  "Peak target": `${summaryModel}?.peakTarget ?? 0`,
};
---

<article class="game-panel p-6 flex flex-col gap-4" x-show={showSummaryModel} x-cloak>
  <h2
    class="text-xl font-semibold"
    x-text={`${summaryModel}?.completionReason === 'checkout170' ? '170 Checkout!' : 'Game Complete'`}
  >
    Game Complete
  </h2>
  <dl class="flex flex-col gap-1 text-sm">
    {
      Object.entries(summary).map(([label, value]) => (
        <SummaryStatRow label={label} value={value} />
      ))
    }
  </dl>

  <h3 class="t font-semibold">Do you want to play again?</h3>
  <div class="grid grid-cols-2 gap-2">
    <button
      type="button"
      class="btn-secondary btn-press"
      :disabled={loadingModel}
      @click="window.location.href='/games'"
    >
      No
    </button>
    <button
      type="button"
      class="btn-primary btn-press"
      :disabled={loadingModel}
      @click="playAgain()"
    >
      Yes
    </button>
  </div>
</article>
```

- [ ] **Step 4: Update Play.astro**

Key changes:

- `gameSession?: TenUpOneDownSession | null` prop (optional, default null)
- `sessionJson = JSON.stringify(gameSession ?? null)`
- Import `Summary`, `PlayShellSkeleton`, `SummarySkeleton`
- Add `x-init="init()"`, `:aria-busy="!ready || (showSummary && !summary)"`
- Wrap play chrome in `x-show="ready && !showSummary"` (OptionModal stays inside)
- Add skeleton/summary slots:

```astro
<div x-show="!ready">
  <PlayShellSkeleton />
</div>

<div x-show="showSummary && !summary" x-cloak>
  <SummarySkeleton />
</div>
<Summary showSummaryModel="showSummary && summary" loadingModel="loading" />
```

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 11: Remove Obsolete Code + Assembly Tests

**Files:**
- Delete obsolete files listed in File Structure Overview
- Create: `app/tests/pages/ten-up-one-down-play-assembly.test.ts`
- Modify: `app/scripts/curl-verify-tuod.sh`
- Modify: `app/tests/lib/server/data/games.test.ts` (if references ten-up-one-down-session)

- [ ] **Step 1: Delete obsolete routes, data layer, and tests**

```bash
cd app
rm src/pages/api/games/ten-up-one-down/session.ts
rm src/pages/api/games/ten-up-one-down/session/round.ts
rm src/pages/api/games/ten-up-one-down/session/round/last.ts
rm src/lib/server/data/ten-up-one-down-session.ts
rm tests/lib/server/data/ten-up-one-down-session.test.ts
rm tests/api/games/ten-up-one-down/session.test.ts
rm tests/api/games/ten-up-one-down/round.test.ts
rm tests/api/games/ten-up-one-down/round-last.test.ts
```

Remove `TenUpOneDownSessionSuccess` from client play flow if unused (keep type only if still referenced elsewhere; grep first).

- [ ] **Step 2: Add play assembly test**

```typescript
// app/tests/pages/ten-up-one-down-play-assembly.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("ten-up-one-down play page assembly", () => {
  it("wires Play.astro with TUOD UI shell and summary", () => {
    const source = readSource("src/components/games/ten-up-one-down/Play.astro");
    expect(source).toContain('import Summary from "./Summary.astro";');
    expect(source).toContain("PlayShellSkeleton");
    expect(source).toContain("SummarySkeleton");
    expect(source).toContain("x-data={`tenUpOneDownPlay(");
    expect(source).toContain('x-init="init()"');
    expect(source).toContain('x-show="ready && !showSummary"');
    expect(source).toContain('x-show="showSummary && !summary"');
    expect(source).toContain('showSummaryModel="showSummary && summary"');
    expect(source).toContain('data-testid="tuod-option-modal"');
  });

  it("starts TUOD via POST form validation", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).toContain("parseTenUpOneDownSettingsFormData");
    expect(source).toContain("buildTenUpOneDownSession");
    expect(source).toContain('slug === "ten-up-one-down"');
    expect(source).not.toContain("getTenUpOneDownSession");
  });

  it("settings shell uses form POST without resume/abandon", () => {
    const source = readSource(
      "src/components/games/ten-up-one-down/TenUpOneDownSettingsShell.astro",
    );
    expect(source).toContain('method="POST"');
    expect(source).not.toContain("hasActiveSession");
    expect(source).not.toContain("resume()");
    expect(source).not.toContain("abandon()");
  });
});
```

- [ ] **Step 3: Update curl-verify-tuod.sh**

Replace session/round API calls with form POST + complete flow. Minimum viable script:

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4321}"
EMAIL="${AUTH_EMAIL:-test@example.com}"
PASS="${AUTH_PASSWORD:-testpass}"
ORIGIN_HEADER=(-H "Origin: $BASE_URL")
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

login() {
  curl -sf -c "$JAR" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > /dev/null
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

HTML=$(curl -sf -b "$JAR" -X POST "$BASE_URL/games/ten-up-one-down" \
  -d "endMode=rounds&roundCount=2")
assert_contains "$HTML" 'tenUpOneDownPlay' "play page renders Alpine factory"
assert_contains "$HTML" 'data-testid="tuod-play-shell-skeleton"' "play shell skeleton present"
assert_contains "$HTML" 'data-testid="tuod-summary-skeleton"' "summary skeleton present"
assert_contains "$HTML" 'currentTarget&quot;:41' "session JSON embedded from POST"

COMPLETE_BODY='{"session":{"slug":"ten-up-one-down","settings":{"endMode":"rounds","roundCount":2},"state":{"currentRound":3,"currentTarget":39,"status":"completed","lastAdjustment":"failure"},"roundHistory":[{"roundNumber":1,"targetAtStart":41,"targetAfter":40,"finished":false,"dartsUsed":3,"dartsOnDouble":0},{"roundNumber":2,"targetAtStart":40,"targetAfter":39,"finished":false,"dartsUsed":3,"dartsOnDouble":0}],"timeRemainingSeconds":null,"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}}'
COMPLETE_RESP=$(curl -sf -b "$JAR" -X POST "$BASE_URL/api/games/ten-up-one-down/complete" \
  "${ORIGIN_HEADER[@]}" \
  -H "Content-Type: application/json" \
  -d "$COMPLETE_BODY")
assert_contains "$COMPLETE_RESP" '"ok":true' "complete endpoint accepts terminal session"
assert_contains "$COMPLETE_RESP" '"completionReason":"rounds"' "complete returns summary"

echo "All curl checks passed"
```

- [ ] **Step 4: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

## Self-Review Checklist

| Requirement | Task |
| ----------- | ---- |
| Form POST game start | Task 7, 8 |
| Client `$persist` session | Task 9 |
| Local round submit/undo (OptionModal preserved) | Task 9 |
| Completion API only DB write | Task 6 |
| Stats + play count on completion | Task 6 |
| Summary skeleton during API | Task 10 |
| Summary stats (incl. peak target, 170 headline) | Task 3, 10 |
| Play again client-side | Task 9 |
| Remove resume/abandon | Task 8 |
| Remove DB session layer | Task 11 |
| Leave clears persist | Task 9 |
| curl script updated | Task 11 |

---

## Final Verification Gate

Run only after Task 11 is complete.

```bash
cd app
npm run check
npm test
npm run build
npx fallow
```

All four must exit 0.

### Fallow cleanup (dead code + orphan types)

`npx fallow` finds unused exports, dependencies, and types. **Do not auto-delete every finding** — verify each one before removing.

**Double-verify checklist:**

1. Cross-check with `rg` for string/dynamic references (Astro `entrypoint`, `import()`, route filenames).
2. Confirm the symbol is not registered indirectly (Alpine `Alpine.data(...)`, API route file paths, Drizzle schema).
3. Only remove code/types after both fallow **and** `npm run check` + `npm test` + `npm run build` pass.

**Known false positive — do NOT delete:**

`src/lib/client/alpine/app.factory.ts` may appear unused. It **is** used — wired as the Alpine entrypoint in `astro.config.mjs`:

```js
alpinejs({ entrypoint: "/src/lib/client/alpine/app.factory" })
```

It is also listed in `.fallowrc.json` → `dynamicallyLoaded`. If fallow still flags it, ignore that finding.

**Expected fallow cleanup after this migration:**

- `TenUpOneDownSessionSuccess` in `api/types.ts` (if no remaining consumers)
- Imports of `getTenUpOneDownSession` anywhere
- `ten-up-one-down-session.ts` and its test file (deleted in Task 11)

After removing genuine dead code from fallow output, re-run the full gate until `npx fallow` is clean (aside from the known `app.factory.ts` false positive above).

---

## Manual Smoke Test

- [ ] **Start game:** Settings → Play → skeleton → live play UI
- [ ] **Round flow:** Enter score → OptionModal → submit → target advances (no page reload)
- [ ] **Undo:** Undo last round locally
- [ ] **Complete (rounds):** Finish all rounds → summary skeleton → summary panel with stats
- [ ] **Complete (170):** Checkout 170 → headline "170 Checkout!"
- [ ] **Play again:** Yes → new session, same settings, no API
- [ ] **Leave:** Confirm leave → `/games`; return to settings shows no resume banner
- [ ] **Refresh during play:** Game resumes from sessionStorage

---

## Execution Handoff

**Plan saved to `docs/superpowers/plans/2026-06-22-ten-up-one-down-client-session.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — implement all tasks in this session with checkpoints

Which approach?
