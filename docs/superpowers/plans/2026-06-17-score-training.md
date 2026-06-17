# Score Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task subagent requirements (all mandatory):**
> 1. **test-driven-development** — for any task that writes or changes code
> 2. **verification-before-completion** — run the per-task verification gate before marking the task done; no completion claims without fresh command output
> 3. **NEVER commit** — do not run `git add`, `git commit`, or `git push` at any point
>
> A task is **not complete** until its verification gate passes with evidence recorded in the subagent's final report.

**Goal:** Add the Score Training game mode — single-player visit scoring (0–180), running total display, rounds or timed end modes, undo, end-of-game summary, and global lifetime stats.

**Architecture:** Mirror the Ten Up One Down session pattern: shared game modules under `score-training/`, Netlify Blobs session storage, REST API routes for session/round/undo/complete, Alpine.js play + settings controllers, Astro components reusing `NumberInputPad`.

**Tech Stack:** Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript, Vitest, jsdom

**Spec:** `docs/superpowers/specs/2026-06-17-score-training-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

---

## Verification Gate (every task)

**Iron law:** No completion claims without fresh verification evidence from this session.

### 1. Static analysis (required every task)

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

### 2. Tests (required every task that adds/changes code)

```bash
npm test
```

Required: exit code 0, 0 failures. Run scoped tests during development; full suite before reporting task complete.

### Dispatcher handoff prompt

```
REQUIRED SUB-SKILLS: test-driven-development (code tasks), verification-before-completion (always).
NEVER COMMIT — do not git add, git commit, or git push.
Before reporting task complete: run npm run check (0/0/0) and npm test (0 failures).
Include fresh command output as evidence. Do not claim success without it.
```

---

## Final Verification Gate (after all tasks)

Run only after Task 14 is complete. REQUIRED SUB-SKILL: verification-before-completion.

```bash
cd app
npm run check
npm test
npm run build
```

All three must exit 0. Paste full output tails as evidence. Do not claim the feature is complete without this.

---

## File Structure Overview

| File | Responsibility |
|---|---|
| `src/lib/shared/games/score-training/constants.ts` | Defaults, min/max bounds |
| `src/lib/shared/games/score-training/settings.ts` | `ScoreTrainingSettings` type |
| `src/lib/shared/games/score-training/session.ts` | Session + state types, runtime guard |
| `src/lib/shared/games/score-training/validation.ts` | Settings + visit score validation |
| `src/lib/shared/games/score-training/round.ts` | Round record build + validate |
| `src/lib/shared/games/score-training/state.ts` | Initial state, apply/revert round |
| `src/lib/shared/games/score-training/summary.ts` | Build `ScoreTrainingSummary` |
| `src/lib/shared/games/score-training/stats.ts` | Apply completion to global stats |
| `src/lib/server/data/score-training-session.ts` | Blob CRUD for active session |
| `src/lib/server/data/player-score-training-stats.ts` | Blob CRUD for lifetime stats |
| `src/pages/api/games/score-training/session.ts` | POST/GET/DELETE session |
| `src/pages/api/games/score-training/session/round.ts` | POST round submit |
| `src/pages/api/games/score-training/session/round/last.ts` | DELETE undo |
| `src/pages/api/games/score-training/session/complete.ts` | POST timer completion |
| `src/lib/client/alpine/games/score-training.settings.ts` | Settings form Alpine |
| `src/lib/client/alpine/games/score-training.play.ts` | Play flow Alpine |
| `src/components/games/score-training/*.astro` | UI components |
| `src/lib/shared/constants/errors.constants.ts` | New message codes |
| `src/lib/shared/api/types.ts` | `ScoreTrainingSessionSuccess` |
| `src/lib/shared/games/types.ts` | `SEED_GAMES` entry |
| `src/lib/shared/games/components.ts` | Component registry |
| `src/lib/client/alpine/app.factory.ts` | Alpine registration |
| `src/pages/games/[game].astro` | Session load guard |
| `src/pages/games/settings-[game].astro` | Active session banner |

---

### Task 1: Constants, Settings & Session Types

**Files:**
- Create: `app/src/lib/shared/games/score-training/constants.ts`
- Create: `app/src/lib/shared/games/score-training/settings.ts`
- Create: `app/src/lib/shared/games/score-training/session.ts`
- Test: `app/tests/lib/shared/games/score-training/constants.test.ts`
- Test: `app/tests/lib/shared/games/score-training/session.test.ts`

- [ ] **Step 1: Write the failing constants test**

```typescript
// app/tests/lib/shared/games/score-training/constants.test.ts
import { describe, it, expect } from "vitest";
import {
  DEFAULT_ROUND_COUNT,
  DEFAULT_PLAYTIME_SECONDS,
  MIN_PLAYTIME_SECONDS,
  MAX_PLAYTIME_SECONDS,
  DARTS_PER_VISIT,
  STARTING_SCORE,
  MIN_VISIT_SCORE,
  MAX_VISIT_SCORE,
} from "@lib/shared/games/score-training/constants";

describe("score-training constants", () => {
  it("exports expected defaults and bounds", () => {
    expect(DEFAULT_ROUND_COUNT).toBe(10);
    expect(DEFAULT_PLAYTIME_SECONDS).toBe(600);
    expect(MIN_PLAYTIME_SECONDS).toBe(300);
    expect(MAX_PLAYTIME_SECONDS).toBe(1800);
    expect(DARTS_PER_VISIT).toBe(3);
    expect(STARTING_SCORE).toBe(0);
    expect(MIN_VISIT_SCORE).toBe(0);
    expect(MAX_VISIT_SCORE).toBe(180);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/score-training/constants.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Create constants, settings, session modules**

```typescript
// app/src/lib/shared/games/score-training/constants.ts
export const DARTS_PER_VISIT = 3;
export const STARTING_SCORE = 0;
export const MIN_VISIT_SCORE = 0;
export const MAX_VISIT_SCORE = 180;
export const DEFAULT_ROUND_COUNT = 10;
export const MIN_ROUND_COUNT = 1;
export const MAX_ROUND_COUNT = 100;
export const DEFAULT_PLAYTIME_SECONDS = 600;
export const MIN_PLAYTIME_SECONDS = 300;
export const MAX_PLAYTIME_SECONDS = 1800;
```

```typescript
// app/src/lib/shared/games/score-training/settings.ts
export type ScoreTrainingSettings =
  | { endMode: "rounds"; roundCount: number }
  | { endMode: "timed"; playtimeSeconds: number };
```

```typescript
// app/src/lib/shared/games/score-training/session.ts
import type { ScoreTrainingSettings } from "@lib/shared/games/score-training/settings";
import type { ScoreTrainingRoundRecord } from "@lib/shared/games/score-training/round";

export type ScoreTrainingGameStatus = "active" | "paused" | "completed";

export type ScoreTrainingGameState = {
  currentRound: number;
  currentScore: number;
  status: ScoreTrainingGameStatus;
  lastScore: number | null;
};

export type ScoreTrainingSession = {
  slug: "score-training";
  settings: ScoreTrainingSettings;
  state: ScoreTrainingGameState;
  roundHistory: ScoreTrainingRoundRecord[];
  timeRemainingSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export function isScoreTrainingSession(value: unknown): value is ScoreTrainingSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const state = record.state;
  return (
    record.slug === "score-training" &&
    state !== null &&
    typeof state === "object" &&
    typeof (state as ScoreTrainingGameState).currentScore === "number" &&
    Array.isArray(record.roundHistory) &&
    record.settings !== null &&
    typeof record.settings === "object"
  );
}
```

Create stub round type file so session.ts compiles:

```typescript
// app/src/lib/shared/games/score-training/round.ts
export type ScoreTrainingRoundRecord = {
  roundNumber: number;
  visitScore: number;
  runningTotal: number;
};
```

- [ ] **Step 4: Write session guard test**

```typescript
// app/tests/lib/shared/games/score-training/session.test.ts
import { describe, it, expect } from "vitest";
import { isScoreTrainingSession } from "@lib/shared/games/score-training/session";

const validSession = {
  slug: "score-training",
  settings: { endMode: "rounds", roundCount: 10 },
  state: { currentRound: 1, currentScore: 0, status: "active", lastScore: null },
  roundHistory: [],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

describe("isScoreTrainingSession", () => {
  it("accepts valid session", () => {
    expect(isScoreTrainingSession(validSession)).toBe(true);
  });

  it("rejects wrong slug", () => {
    expect(isScoreTrainingSession({ ...validSession, slug: "501" })).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests and check**

Run: `cd app && npm test -- tests/lib/shared/games/score-training/`  
Run: `cd app && npm run check`  
Expected: PASS, 0/0/0

---

### Task 2: Validation

**Files:**
- Create: `app/src/lib/shared/games/score-training/validation.ts`
- Modify: `app/src/lib/shared/constants/errors.constants.ts`
- Test: `app/tests/lib/shared/games/score-training/validation.test.ts`

- [ ] **Step 1: Add message codes**

Add to `MessageCode` in `errors.constants.ts`:

```typescript
INVALID_SCORE: "INVALID_SCORE",
GAME_COMPLETED: "GAME_COMPLETED",
NO_ROUNDS_TO_UNDO: "NO_ROUNDS_TO_UNDO",
```

Add matching entries in `errorMessages`.

- [ ] **Step 2: Write failing validation tests**

```typescript
// app/tests/lib/shared/games/score-training/validation.test.ts
import { describe, it, expect } from "vitest";
import {
  validateScoreTrainingSettings,
  validateVisitScore,
} from "@lib/shared/games/score-training/validation";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("validateScoreTrainingSettings", () => {
  it("accepts rounds mode", () => {
    const result = validateScoreTrainingSettings({ endMode: "rounds", roundCount: 10 });
    expect(result).toEqual({ valid: true, value: { endMode: "rounds", roundCount: 10 } });
  });

  it("accepts timed mode", () => {
    const result = validateScoreTrainingSettings({ endMode: "timed", playtimeSeconds: 600 });
    expect(result).toEqual({ valid: true, value: { endMode: "timed", playtimeSeconds: 600 } });
  });

  it("rejects invalid round count", () => {
    const result = validateScoreTrainingSettings({ endMode: "rounds", roundCount: 0 });
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });
});

describe("validateVisitScore", () => {
  it("accepts 0–180", () => {
    expect(validateVisitScore(60)).toEqual({ valid: true, value: 60 });
    expect(validateVisitScore(0)).toEqual({ valid: true, value: 0 });
    expect(validateVisitScore(180)).toEqual({ valid: true, value: 180 });
  });

  it("rejects out of range", () => {
    expect(validateVisitScore(181)).toEqual({ valid: false, code: MessageCode.INVALID_SCORE });
    expect(validateVisitScore(-1)).toEqual({ valid: false, code: MessageCode.INVALID_SCORE });
    expect(validateVisitScore(60.5)).toEqual({ valid: false, code: MessageCode.INVALID_SCORE });
  });
});
```

- [ ] **Step 3: Implement validation**

```typescript
// app/src/lib/shared/games/score-training/validation.ts
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  MIN_ROUND_COUNT, MAX_ROUND_COUNT,
  MIN_PLAYTIME_SECONDS, MAX_PLAYTIME_SECONDS,
  MIN_VISIT_SCORE, MAX_VISIT_SCORE,
} from "@lib/shared/games/score-training/constants";
import type { ScoreTrainingSettings } from "@lib/shared/games/score-training/settings";

export type ValidateSettingsResult =
  | { valid: true; value: ScoreTrainingSettings }
  | { valid: false; code: typeof MessageCode.INVALID_GAME_SETTINGS };

export type ValidateVisitScoreResult =
  | { valid: true; value: number }
  | { valid: false; code: typeof MessageCode.INVALID_SCORE };

export function validateScoreTrainingSettings(raw: Record<string, unknown>): ValidateSettingsResult {
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

export function validateVisitScore(value: unknown): ValidateVisitScoreResult {
  const score = Number(value);
  if (!Number.isInteger(score) || score < MIN_VISIT_SCORE || score > MAX_VISIT_SCORE) {
    return { valid: false, code: MessageCode.INVALID_SCORE };
  }
  return { valid: true, value: score };
}
```

- [ ] **Step 4: Run tests and check**

Run: `cd app && npm test -- tests/lib/shared/games/score-training/validation.test.ts`  
Run: `cd app && npm run check`  
Expected: PASS, 0/0/0

---

### Task 3: Round Records & State

**Files:**
- Modify: `app/src/lib/shared/games/score-training/round.ts`
- Create: `app/src/lib/shared/games/score-training/state.ts`
- Test: `app/tests/lib/shared/games/score-training/round.test.ts`
- Test: `app/tests/lib/shared/games/score-training/state.test.ts`

- [ ] **Step 1: Write failing round tests**

```typescript
// app/tests/lib/shared/games/score-training/round.test.ts
import { describe, it, expect } from "vitest";
import { buildRoundRecord, validateRoundRecord } from "@lib/shared/games/score-training/round";

describe("buildRoundRecord", () => {
  it("builds record with running total", () => {
    expect(buildRoundRecord(1, 60, 0)).toEqual({
      roundNumber: 1, visitScore: 60, runningTotal: 60,
    });
    expect(buildRoundRecord(2, 45, 60)).toEqual({
      roundNumber: 2, visitScore: 45, runningTotal: 105,
    });
  });
});

describe("validateRoundRecord", () => {
  it("validates matching round number and score range", () => {
    const record = buildRoundRecord(1, 60, 0);
    expect(validateRoundRecord(record, 1)).toEqual({ valid: true });
    expect(validateRoundRecord(record, 2).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Implement round module**

```typescript
// app/src/lib/shared/games/score-training/round.ts
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { MAX_VISIT_SCORE, MIN_VISIT_SCORE } from "@lib/shared/games/score-training/constants";

export type ScoreTrainingRoundRecord = {
  roundNumber: number;
  visitScore: number;
  runningTotal: number;
};

export function buildRoundRecord(
  roundNumber: number,
  visitScore: number,
  currentScore: number,
): ScoreTrainingRoundRecord {
  return { roundNumber, visitScore, runningTotal: currentScore + visitScore };
}

export type ValidateRoundResult =
  | { valid: true }
  | { valid: false; code: typeof MessageCode.INVALID_ROUND | typeof MessageCode.INVALID_SCORE };

export function validateRoundRecord(
  record: ScoreTrainingRoundRecord,
  expectedRoundNumber: number,
): ValidateRoundResult {
  if (record.roundNumber !== expectedRoundNumber) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  if (!Number.isInteger(record.visitScore) || record.visitScore < MIN_VISIT_SCORE || record.visitScore > MAX_VISIT_SCORE) {
    return { valid: false, code: MessageCode.INVALID_SCORE };
  }
  return { valid: true };
}
```

- [ ] **Step 3: Write failing state tests**

```typescript
// app/tests/lib/shared/games/score-training/state.test.ts
import { describe, it, expect } from "vitest";
import {
  createInitialGameState,
  applyRoundToState,
  revertRoundFromState,
  isGameComplete,
} from "@lib/shared/games/score-training/state";
import { buildRoundRecord } from "@lib/shared/games/score-training/round";

describe("createInitialGameState", () => {
  it("starts at round 1, score 0", () => {
    expect(createInitialGameState({ endMode: "rounds", roundCount: 10 })).toEqual({
      currentRound: 1, currentScore: 0, status: "active", lastScore: null,
    });
  });
});

describe("applyRoundToState", () => {
  it("updates score and increments round", () => {
    const state = createInitialGameState({ endMode: "rounds", roundCount: 10 });
    const round = buildRoundRecord(1, 60, 0);
    const updated = applyRoundToState(state, round, { endMode: "rounds", roundCount: 10 });
    expect(updated.currentScore).toBe(60);
    expect(updated.lastScore).toBe(60);
    expect(updated.currentRound).toBe(2);
    expect(updated.status).toBe("active");
  });

  it("completes after final round in rounds mode", () => {
    const state = { currentRound: 10, currentScore: 400, status: "active" as const, lastScore: 40 };
    const round = buildRoundRecord(10, 45, 400);
    const updated = applyRoundToState(state, round, { endMode: "rounds", roundCount: 10 });
    expect(updated.status).toBe("completed");
  });
});

describe("isGameComplete", () => {
  it("completes rounds mode when round exceeds count", () => {
    expect(isGameComplete(
      { currentRound: 11, currentScore: 0, status: "active", lastScore: null },
      { endMode: "rounds", roundCount: 10 },
      false,
    )).toBe(true);
  });

  it("completes timed mode on timerExpired", () => {
    expect(isGameComplete(
      { currentRound: 3, currentScore: 100, status: "active", lastScore: 30 },
      { endMode: "timed", playtimeSeconds: 600 },
      true,
    )).toBe(true);
  });
});
```

- [ ] **Step 4: Implement state module**

```typescript
// app/src/lib/shared/games/score-training/state.ts
import { STARTING_SCORE } from "@lib/shared/games/score-training/constants";
import type { ScoreTrainingSettings } from "@lib/shared/games/score-training/settings";
import type { ScoreTrainingGameState } from "@lib/shared/games/score-training/session";
import type { ScoreTrainingRoundRecord } from "@lib/shared/games/score-training/round";

export function createInitialGameState(_settings: ScoreTrainingSettings): ScoreTrainingGameState {
  return {
    currentRound: 1,
    currentScore: STARTING_SCORE,
    status: "active",
    lastScore: null,
  };
}

export function applyRoundToState(
  state: ScoreTrainingGameState,
  round: ScoreTrainingRoundRecord,
  settings: ScoreTrainingSettings,
  timerExpired = false,
): ScoreTrainingGameState {
  const nextRound = state.currentRound + 1;
  let status = state.status;

  if (settings.endMode === "rounds" && nextRound > settings.roundCount) {
    status = "completed";
  } else if (settings.endMode === "timed" && timerExpired) {
    status = "completed";
  }

  return {
    currentRound: nextRound,
    currentScore: round.runningTotal,
    lastScore: round.visitScore,
    status,
  };
}

export function revertRoundFromState(
  state: ScoreTrainingGameState,
  removedRound: ScoreTrainingRoundRecord,
  previousLastScore: number | null,
): ScoreTrainingGameState {
  return {
    currentRound: state.currentRound - 1,
    currentScore: removedRound.runningTotal - removedRound.visitScore,
    lastScore: previousLastScore,
    status: state.status === "completed" ? "active" : state.status,
  };
}

export function isGameComplete(
  state: ScoreTrainingGameState,
  settings: ScoreTrainingSettings,
  timerExpired: boolean,
): boolean {
  if (state.status === "completed") return true;
  if (settings.endMode === "rounds" && state.currentRound > settings.roundCount) return true;
  if (settings.endMode === "timed" && timerExpired) return true;
  return false;
}
```

- [ ] **Step 5: Run tests and check**

Run: `cd app && npm test -- tests/lib/shared/games/score-training/round.test.ts tests/lib/shared/games/score-training/state.test.ts`  
Run: `cd app && npm run check`  
Expected: PASS, 0/0/0

---

### Task 4: Summary & Global Stats

**Files:**
- Create: `app/src/lib/shared/games/score-training/summary.ts`
- Create: `app/src/lib/shared/games/score-training/stats.ts`
- Test: `app/tests/lib/shared/games/score-training/summary.test.ts`
- Test: `app/tests/lib/shared/games/score-training/stats.test.ts`

- [ ] **Step 1: Write failing summary test**

```typescript
// app/tests/lib/shared/games/score-training/summary.test.ts
import { describe, it, expect } from "vitest";
import { buildSummary } from "@lib/shared/games/score-training/summary";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";

const baseSession: ScoreTrainingSession = {
  slug: "score-training",
  settings: { endMode: "rounds", roundCount: 10 },
  state: { currentRound: 4, currentScore: 165, status: "completed", lastScore: 45 },
  roundHistory: [
    { roundNumber: 1, visitScore: 60, runningTotal: 60 },
    { roundNumber: 2, visitScore: 60, runningTotal: 120 },
    { roundNumber: 3, visitScore: 45, runningTotal: 165 },
  ],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

describe("buildSummary", () => {
  it("computes summary from session", () => {
    expect(buildSummary(baseSession)).toEqual({
      totalScore: 165,
      threeDartAverage: 55,
      roundsPlayed: 3,
      dartsThrown: 9,
    });
  });

  it("handles zero rounds", () => {
    const empty = { ...baseSession, state: { ...baseSession.state, currentScore: 0 }, roundHistory: [] };
    expect(buildSummary(empty)).toEqual({
      totalScore: 0, threeDartAverage: 0, roundsPlayed: 0, dartsThrown: 0,
    });
  });
});
```

- [ ] **Step 2: Implement summary**

```typescript
// app/src/lib/shared/games/score-training/summary.ts
import { DARTS_PER_VISIT } from "@lib/shared/games/score-training/constants";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";

export type ScoreTrainingSummary = {
  totalScore: number;
  threeDartAverage: number;
  roundsPlayed: number;
  dartsThrown: number;
};

export function buildSummary(session: ScoreTrainingSession): ScoreTrainingSummary {
  const roundsPlayed = session.roundHistory.length;
  const totalScore = session.state.currentScore;
  return {
    totalScore,
    threeDartAverage: roundsPlayed > 0 ? totalScore / roundsPlayed : 0,
    roundsPlayed,
    dartsThrown: roundsPlayed * DARTS_PER_VISIT,
  };
}
```

- [ ] **Step 3: Write failing stats test**

```typescript
// app/tests/lib/shared/games/score-training/stats.test.ts
import { describe, it, expect } from "vitest";
import { createEmptyScoreTrainingStats, applyGameCompletionToStats } from "@lib/shared/games/score-training/stats";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";

const session: ScoreTrainingSession = {
  slug: "score-training",
  settings: { endMode: "rounds", roundCount: 10 },
  state: { currentRound: 3, currentScore: 165, status: "completed", lastScore: 45 },
  roundHistory: [
    { roundNumber: 1, visitScore: 60, runningTotal: 60 },
    { roundNumber: 2, visitScore: 60, runningTotal: 120 },
    { roundNumber: 3, visitScore: 45, runningTotal: 165 },
  ],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

describe("applyGameCompletionToStats", () => {
  it("updates lifetime aggregates and bests", () => {
    const stats = createEmptyScoreTrainingStats();
    applyGameCompletionToStats(stats, session);
    expect(stats).toEqual({
      gamesCompleted: 1,
      totalDartsThrown: 9,
      totalPointsScored: 165,
      bestVisitScore: 60,
      bestGameAverage: 55,
    });
  });

  it("updates bests only when exceeded", () => {
    const stats = { gamesCompleted: 1, totalDartsThrown: 9, totalPointsScored: 165, bestVisitScore: 100, bestGameAverage: 80 };
    applyGameCompletionToStats(stats, session);
    expect(stats.bestVisitScore).toBe(100);
    expect(stats.bestGameAverage).toBe(80);
    expect(stats.gamesCompleted).toBe(2);
  });
});
```

- [ ] **Step 4: Implement stats**

```typescript
// app/src/lib/shared/games/score-training/stats.ts
import { DARTS_PER_VISIT } from "@lib/shared/games/score-training/constants";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";
import { buildSummary } from "@lib/shared/games/score-training/summary";

export type PlayerScoreTrainingStats = {
  gamesCompleted: number;
  totalDartsThrown: number;
  totalPointsScored: number;
  bestVisitScore: number;
  bestGameAverage: number;
};

export function createEmptyScoreTrainingStats(): PlayerScoreTrainingStats {
  return {
    gamesCompleted: 0,
    totalDartsThrown: 0,
    totalPointsScored: 0,
    bestVisitScore: 0,
    bestGameAverage: 0,
  };
}

export function applyGameCompletionToStats(
  stats: PlayerScoreTrainingStats,
  session: ScoreTrainingSession,
): void {
  const summary = buildSummary(session);
  stats.gamesCompleted += 1;
  stats.totalDartsThrown += summary.dartsThrown;
  stats.totalPointsScored += summary.totalScore;

  const bestVisit = session.roundHistory.reduce(
    (max, r) => Math.max(max, r.visitScore),
    0,
  );
  if (bestVisit > stats.bestVisitScore) stats.bestVisitScore = bestVisit;
  if (summary.threeDartAverage > stats.bestGameAverage) {
    stats.bestGameAverage = summary.threeDartAverage;
  }
}
```

- [ ] **Step 5: Run tests and check**

Run: `cd app && npm test -- tests/lib/shared/games/score-training/summary.test.ts tests/lib/shared/games/score-training/stats.test.ts`  
Run: `cd app && npm run check`  
Expected: PASS, 0/0/0

---

### Task 5: Server Data Layer

**Files:**
- Create: `app/src/lib/server/data/score-training-session.ts`
- Create: `app/src/lib/server/data/player-score-training-stats.ts`
- Test: `app/tests/lib/server/data/score-training-session.test.ts`

- [ ] **Step 1: Write failing session data test**

Mirror `tests/lib/server/data/ten-up-one-down-session.test.ts` pattern. Test `createScoreTrainingSession` sets initial state and `timeRemainingSeconds` for timed mode.

- [ ] **Step 2: Implement data modules**

Mirror `ten-up-one-down-session.ts` with `GAME_SLUG = "score-training"`, using `createInitialGameState` and `isScoreTrainingSession`.

```typescript
// app/src/lib/server/data/player-score-training-stats.ts
import { getStore } from "@netlify/blobs";
import { createEmptyScoreTrainingStats } from "@lib/shared/games/score-training/stats";
import type { PlayerScoreTrainingStats } from "@lib/shared/games/score-training/stats";

const STORE_NAME = "player-score-training-stats";

export async function getPlayerScoreTrainingStats(userId: string): Promise<PlayerScoreTrainingStats> {
  const store = getStore(STORE_NAME);
  const data = await store.get(userId, { type: "json" });
  return (data as PlayerScoreTrainingStats | null) ?? createEmptyScoreTrainingStats();
}

export async function savePlayerScoreTrainingStats(
  userId: string,
  stats: PlayerScoreTrainingStats,
): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(userId, stats);
}
```

- [ ] **Step 3: Run tests and check**

Run: `cd app && npm test -- tests/lib/server/data/score-training-session.test.ts`  
Run: `cd app && npm run check`  
Expected: PASS, 0/0/0

---

### Task 6: Session API

**Files:**
- Create: `app/src/pages/api/games/score-training/session.ts`
- Test: `app/tests/api/games/score-training/session.test.ts`

- [ ] **Step 1: Write failing API tests**

Mirror `tests/api/games/ten-up-one-down/session.test.ts`:
- 401 unauthorized
- 409 session exists on POST
- 200 creates session on POST
- GET returns active session
- DELETE removes session

- [ ] **Step 2: Implement session API**

Copy structure from `ten-up-one-down/session.ts`, swap imports to score-training modules and `validateScoreTrainingSettings`.

- [ ] **Step 3: Run tests and check**

Run: `cd app && npm test -- tests/api/games/score-training/session.test.ts`  
Run: `cd app && npm run check`  
Expected: PASS, 0/0/0

---

### Task 7: Round, Undo & Complete APIs

**Files:**
- Create: `app/src/pages/api/games/score-training/session/round.ts`
- Create: `app/src/pages/api/games/score-training/session/round/last.ts`
- Create: `app/src/pages/api/games/score-training/session/complete.ts`
- Modify: `app/src/lib/shared/api/types.ts`
- Test: `app/tests/api/games/score-training/round.test.ts`
- Test: `app/tests/api/games/score-training/round-last.test.ts`
- Test: `app/tests/api/games/score-training/complete.test.ts`

- [ ] **Step 1: Add API type**

```typescript
// app/src/lib/shared/api/types.ts
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";
import type { ScoreTrainingSummary } from "@lib/shared/games/score-training/summary";

export type ScoreTrainingSessionSuccess = {
  ok: true;
  session: ScoreTrainingSession;
  completed?: boolean;
  summary?: ScoreTrainingSummary;
};
```

Add to `ApiSuccess` union.

- [ ] **Step 2: Write failing round API tests**

Round POST tests:
- 401, 404 no session, 400 invalid score
- 200 appends round, updates session
- 200 completes on final round, returns `summary`, deletes session, updates global stats
- Accepts `{ round, timeRemainingSeconds, timerExpired }` payload

Undo DELETE tests:
- 400 when no rounds (`NO_ROUNDS_TO_UNDO`)
- 200 reverts state (no global stats change)

Complete POST tests:
- 200 on timed expiry with 0+ rounds, returns summary, deletes session
- 400 when session already completed

- [ ] **Step 3: Implement round API**

Key logic in `round.ts`:

```typescript
// On success path:
if (typeof body.timeRemainingSeconds === "number") {
  session.timeRemainingSeconds = body.timeRemainingSeconds;
}
session.state = applyRoundToState(session.state, round, session.settings, body.timerExpired === true);
session.roundHistory.push(round);

if (session.state.status === "completed" || body.timerExpired === true) {
  session.state.status = "completed";
  const summary = buildSummary(session);
  const stats = await getPlayerScoreTrainingStats(auth.username);
  applyGameCompletionToStats(stats, session);
  await savePlayerScoreTrainingStats(auth.username, stats);
  await deleteScoreTrainingSession(auth.username);
  return jsonResponse({ ok: true, session, completed: true, summary }, 200);
}
await saveScoreTrainingSession(auth.username, session);
return jsonResponse({ ok: true, session }, 200);
```

Undo `last.ts` — no stats calls; use `revertRoundFromState` with `previousLastScore` from `roundHistory.at(-2)?.visitScore ?? null`.

`complete.ts` — for timer expiry with no visit in progress:

```typescript
export const POST: APIRoute = async ({ request, cookies }) => {
  // auth + load session
  // reject if completed or rounds mode
  // optional: sync timeRemainingSeconds from body
  session.state.status = "completed";
  const summary = buildSummary(session);
  // apply stats, delete session
  return jsonResponse({ ok: true, session, completed: true, summary }, 200);
};
```

- [ ] **Step 4: Run tests and check**

Run: `cd app && npm test -- tests/api/games/score-training/`  
Run: `cd app && npm run check`  
Expected: PASS, 0/0/0

---

### Task 8: Game Registration

**Files:**
- Modify: `app/src/lib/shared/games/types.ts`
- Modify: `app/src/lib/shared/games/components.ts`
- Create stub: `app/src/components/games/score-training/SettingsForm.astro`
- Create stub: `app/src/components/games/score-training/Play.astro`

- [ ] **Step 1: Register game**

```typescript
// types.ts SEED_GAMES — add:
{ slug: "score-training", displayName: "Score Training", sortOrder: 4, enabled: true },
```

```typescript
// components.ts — add imports and registry entry
"score-training": { settingsForm: SettingsScoreTraining, play: PlayScoreTraining },
```

- [ ] **Step 2: Create minimal stub components**

```astro
---
// SettingsForm.astro — placeholder fieldset
---
<fieldset><legend>Score Training settings</legend></fieldset>
```

```astro
---
// Play.astro
interface Props { displayName: string; gameSession: unknown; }
const { displayName } = Astro.props;
---
<section><h2>{displayName}</h2></section>
```

- [ ] **Step 3: Run check and tests**

Run: `cd app && npm run check`  
Run: `cd app && npm test`  
Expected: PASS, 0/0/0

---

### Task 9: Settings UI

**Files:**
- Create: `app/src/components/games/score-training/SettingsForm.astro`
- Create: `app/src/components/games/score-training/ScoreTrainingSettingsShell.astro`
- Create: `app/src/lib/client/alpine/games/score-training.settings.ts`
- Modify: `app/src/lib/client/alpine/app.factory.ts`
- Modify: `app/src/pages/games/settings-[game].astro`
- Test: `app/tests/lib/client/alpine/games/score-training.settings.test.ts`

- [ ] **Step 1: SettingsForm**

Mirror TUOD `SettingsForm.astro` but timed field uses minutes:

```astro
<label class="block space-y-1" x-show="endMode === 'timed'" x-cloak>
  <span class="text-text-muted text-sm">Play time (minutes)</span>
  <input type="number" name="playtimeMinutes" value="10" min="5" max="30" step="1" class="input-field" />
</label>
```

- [ ] **Step 2: Alpine settings factory**

Copy `ten-up-one-down.settings.ts`, change:
- API paths to `/api/games/score-training/session`
- `formDataToSettings`: convert `playtimeMinutes` → `playtimeSeconds` (`minutes * 60`), omit `playtimeMinutes` from POST body

```typescript
formDataToSettings(form: HTMLFormElement): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value !== "string") continue;
    if (key === "roundCount") {
      settings.roundCount = Number(value);
    } else if (key === "playtimeMinutes") {
      settings.playtimeSeconds = Number(value) * 60;
    } else {
      settings[key] = value;
    }
  }
  return settings;
},
```

- [ ] **Step 3: Settings shell + page wiring**

Copy `TenUpOneDownSettingsShell.astro` → `ScoreTrainingSettingsShell.astro`, use `scoreTrainingSettings`.

In `settings-[game].astro`, add branch for `score-training` (mirror TUOD `hasActiveSession` check with `getScoreTrainingSession`).

Register in `app.factory.ts`: `Alpine.data("scoreTrainingSettings", scoreTrainingSettings)`.

- [ ] **Step 4: Write settings test**

Test `formDataToSettings` converts 10 minutes → 600 seconds.

- [ ] **Step 5: Run tests and check**

Run: `cd app && npm test -- tests/lib/client/alpine/games/score-training.settings.test.ts`  
Run: `cd app && npm run check`  
Expected: PASS, 0/0/0

---

### Task 10: Play UI Components

**Files:**
- Create: `app/src/components/games/score-training/ScoreCard.astro`
- Create: `app/src/components/games/score-training/ProgressBar.astro`
- Create: `app/src/components/games/score-training/Summary.astro`

- [ ] **Step 1: ScoreCard**

Mirror `TargetCard.astro` layout:

```astro
<article class="game-panel p-3 h-40" data-testid="st-score-card">
  <div class="flex items-center justify-center flex-col gap-4">
    <div class="flex items-center justify-center flex-col gap-2">
      <span class="text-sm text-text-muted font-mono uppercase tracking-wider">Current Score</span>
      <span class="text-4xl font-bold" x-text="session.state.currentScore"></span>
    </div>
    <div class="flex items-center justify-center gap-4 text-xs text-text-muted font-mono">
      <span>Avg: <span x-text="threeDartAverageDisplay"></span></span>
      <span>Darts: <span x-text="dartsThrownDisplay"></span></span>
      <span>Last: <span x-text="lastScoreDisplay"></span></span>
    </div>
  </div>
</article>
```

- [ ] **Step 2: ProgressBar**

Mirror `RoundProgress.astro` but timed mode shows **only** timer + pause (no round number):

```astro
<span x-show="session.settings.endMode === 'rounds'"
  x-text="'Round ' + session.state.currentRound + ' of ' + session.settings.roundCount"></span>

<span x-show="session.settings.endMode === 'timed'">
  <span x-text="timerDisplay"></span>
</span>
```

- [ ] **Step 3: Summary**

```astro
<article class="game-panel p-6 flex flex-col gap-4" x-show="showSummary" x-cloak>
  <h2 class="text-xl font-semibold">Game Complete</h2>
  <dl class="grid grid-cols-2 gap-3 text-sm">
    <dt class="text-text-muted">Total score</dt>
    <dd x-text="summary.totalScore"></dd>
    <dt class="text-text-muted">3-dart average</dt>
    <dd x-text="summaryAverageDisplay"></dd>
    <dt class="text-text-muted">Rounds played</dt>
    <dd x-text="summary.roundsPlayed"></dd>
    <dt class="text-text-muted">Darts thrown</dt>
    <dd x-text="summary.dartsThrown"></dd>
  </dl>
  <a href="/games" class="btn-primary text-center">Back to games</a>
</article>
```

- [ ] **Step 4: Run check**

Run: `cd app && npm run check`  
Expected: 0/0/0

---

### Task 11: Play Alpine Controller

**Files:**
- Create: `app/src/lib/client/alpine/games/score-training.play.ts`
- Test: `app/tests/lib/client/alpine/games/score-training.play.test.ts`

- [ ] **Step 1: Write failing play tests**

```typescript
// app/tests/lib/client/alpine/games/score-training.play.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { scoreTrainingPlay } from "@lib/client/alpine/games/score-training.play";

const roundsSession = {
  slug: "score-training" as const,
  settings: { endMode: "rounds" as const, roundCount: 10 },
  state: { currentRound: 1, currentScore: 0, status: "active" as const, lastScore: null },
  roundHistory: [],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

describe("scoreTrainingPlay", () => {
  it("computes threeDartAverageDisplay", () => {
    const play = scoreTrainingPlay(structuredClone(roundsSession));
    expect(play.threeDartAverageDisplay).toBe("0.0");
    play.session.roundHistory = [{ roundNumber: 1, visitScore: 60, runningTotal: 60 }];
    play.session.state.currentScore = 60;
    expect(play.threeDartAverageDisplay).toBe("60.0");
  });

  it("timerPausedWhenEnteringScore", () => {
    const timed = {
      ...roundsSession,
      settings: { endMode: "timed" as const, playtimeSeconds: 60 },
      timeRemainingSeconds: 60,
    };
    const play = scoreTrainingPlay(structuredClone(timed));
    play.init();
    play.score = "6";
    expect(play.timerShouldTick).toBe(false);
  });
});
```

- [ ] **Step 2: Implement play controller**

Key getters and methods:

```typescript
export function scoreTrainingPlay(initialSession: ScoreTrainingSession) {
  let timerId: ReturnType<typeof setInterval> | null = null;

  return {
    session: initialSession,
    score: null as string | null,
    loading: false,
    error: "",
    showSummary: false,
    summary: null as ScoreTrainingSummary | null,
    timerExpired: false,

    get controlsDisabled() {
      return this.loading || this.session.state.status === "paused" || this.showSummary;
    },

    get timerShouldTick() {
      return (
        this.session.settings.endMode === "timed" &&
        this.session.state.status === "active" &&
        this.score === null &&
        !this.showSummary
      );
    },

    get threeDartAverageDisplay() {
      const rounds = this.session.roundHistory.length;
      if (rounds === 0) return "0.0";
      return (this.session.state.currentScore / rounds).toFixed(1);
    },

    get dartsThrownDisplay() {
      return String(this.session.roundHistory.length * 3);
    },

    get lastScoreDisplay() {
      return this.session.state.lastScore === null ? "—" : String(this.session.state.lastScore);
    },

    get timerDisplay() { /* MM:SS from timeRemainingSeconds */ },

    init() {
      if (this.session.settings.endMode === "timed") this.startTimer();
    },

    submitScore() {
      const parsed = Number(this.score);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 180) return;
      // POST round with buildRoundRecord
    },

    async completeOnTimerExpiry() {
      // POST /session/complete when timer hits 0 and score === null
    },

    togglePause() { /* same pattern as TUOD */ },
    startTimer() { /* tick only when timerShouldTick */ },
    undo() { /* DELETE round/last */ },
    leave() { /* confirmation modal */ },
  };
}
```

On round POST success with `completed: true`: set `showSummary = true`, store `summary`, stop timer.

On timer tick reaching 0 with `score === null`: call `completeOnTimerExpiry()`.

- [ ] **Step 3: Run tests and check**

Run: `cd app && npm test -- tests/lib/client/alpine/games/score-training.play.test.ts`  
Run: `cd app && npm run check`  
Expected: PASS, 0/0/0

---

### Task 12: Play Page Assembly

**Files:**
- Create: `app/src/components/games/score-training/Play.astro`
- Modify: `app/src/lib/client/alpine/app.factory.ts`
- Modify: `app/src/pages/games/[game].astro`

- [ ] **Step 1: Play.astro**

Mirror `ten-up-one-down/Play.astro`:

```astro
---
import NumberInputPad from "@components/ui/NumberInputPad.astro";
import ScoreCard from "./ScoreCard.astro";
import ProgressBar from "./ProgressBar.astro";
import Summary from "./Summary.astro";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";
import LeaveIcon from "@icons/leave.svg";

interface Props {
  displayName: string;
  gameSession: ScoreTrainingSession;
}
const { displayName, gameSession } = Astro.props;
const sessionJson = JSON.stringify(gameSession).replace(/</g, "\\u003c");
---

<section class="relative flex-1 h-full flex flex-col gap-4"
  x-data={`scoreTrainingPlay(${sessionJson})`}
  x-init="init()"
>
  <!-- header with leave -->
  <div x-show="!showSummary">
    <ProgressBar />
    <ScoreCard />
    <article class="game-panel flex-1 p-4 flex flex-col">
      <NumberInputPad
        scoreModel="score"
        submitAction="submitScore()"
        disabledExpr="controlsDisabled"
        canUndoExpr="session.roundHistory.length > 0"
        undoAction="undo()"
      />
    </article>
  </div>
  <Summary />
  <p x-show="error" x-cloak x-text="error" class="text-sm text-red-400" role="alert"></p>
</section>
```

- [ ] **Step 2: Wire play page**

In `[game].astro`, add score-training branch (mirror TUOD):

```typescript
const scoreTrainingSession =
  slug === "score-training" && session.isLoggedIn && session.username
    ? await getScoreTrainingSession(session.username)
    : null;

if (slug === "score-training" && !scoreTrainingSession) {
  return Astro.redirect(`/games/settings-${slug}`);
}
```

Pass `gameSession` to Play component.

Register `Alpine.data("scoreTrainingPlay", scoreTrainingPlay)` in `app.factory.ts`.

- [ ] **Step 3: Run full tests and check**

Run: `cd app && npm test`  
Run: `cd app && npm run check`  
Expected: PASS, 0/0/0

---

### Task 13: Paths & Games List Test Update

**Files:**
- Modify: `app/tests/lib/shared/games/paths.test.ts`
- Modify: `app/tests/lib/server/data/games.test.ts`

- [ ] **Step 1: Update existing tests**

Add `score-training` to any catalog count assertions if present.

- [ ] **Step 2: Run tests and check**

Run: `cd app && npm test`  
Run: `cd app && npm run check`  
Expected: PASS, 0/0/0

---

### Task 14: Final Verification

- [ ] **Step 1: Full static analysis**

```bash
cd app && npm run check
```

Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Full test suite**

```bash
cd app && npm test
```

Expected: exit 0, 0 failures.

- [ ] **Step 3: Production build**

```bash
cd app && npm run build
```

Expected: exit 0.

- [ ] **Step 4: Spec coverage checklist**

| Spec requirement | Task |
|---|---|
| Settings rounds/timed, minutes UI | 9 |
| 0–180 visit scoring | 2, 3, 7 |
| Running total display | 10, 12 |
| 3-dart avg / darts / last score | 10, 11 |
| NumberInputPad | 12 |
| Undo unlimited | 7, 11 |
| Timer auto-pause + manual pause | 11 |
| Timed unlimited visits | 3, 7 |
| End summary | 4, 7, 10, 11 |
| Global stats on completion | 4, 7 |
| Session lifecycle | 5, 6, 7 |
| Game registration | 8 |

- [ ] **Step 5: Report evidence**

Paste output tails from all three commands. Do not claim complete without them.

---

## Plan Self-Review Notes

- **Spec coverage:** All §1–§11 requirements mapped in Task 14 checklist.
- **Placeholder scan:** No TBD/TODO steps.
- **Type consistency:** `ScoreTrainingRoundRecord.roundNumber`, `state.currentRound`, and `buildRoundRecord` all use 1-based visit indexing throughout.
- **Timer completion:** `session/complete` endpoint handles expiry with no score in progress; round POST handles expiry after final visit submit.
