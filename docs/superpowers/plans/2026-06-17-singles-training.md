# Singles Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task subagent requirements (all mandatory):**
> 1. **test-driven-development** — for any task that writes or changes code
> 2. **verification-before-completion** — run the per-task verification gate before marking the task done; no completion claims without fresh command output
> 3. **NEVER commit** — do not run `git add`, `git commit`, or `git push` at any point
>
> A task is **not complete** until its verification gate passes with evidence recorded in the subagent's final report.

**Goal:** Add the Singles Training game — 21-target accuracy exercise with per-dart input, direction/mode/scoring settings, hard/extreme dead-on-failure, end summary with play-again prompt, lifetime stats, and listing on the games overview page.

**Architecture:** Per-dart API mirroring score-training session patterns. Shared logic under `singles-training/`, Netlify Blobs for session + lifetime stats, Alpine.js play/settings controllers, Astro components based on `test.astro` mockup.

**Tech Stack:** Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript, Vitest, jsdom

**Spec:** `docs/superpowers/specs/2026-06-17-singles-training-design.md`  
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

Run only after Task 16 is complete. REQUIRED SUB-SKILL: verification-before-completion.

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
| `src/lib/shared/games/singles-training/constants.ts` | `DARTS_PER_VISIT`, `TARGET_COUNT`, defaults |
| `src/lib/shared/games/singles-training/settings.ts` | Settings type |
| `src/lib/shared/games/singles-training/session.ts` | Session + state types, runtime guard |
| `src/lib/shared/games/singles-training/target-sequence.ts` | Build 21-target sequence from direction |
| `src/lib/shared/games/singles-training/dart.ts` | Outcome types, points, labels, validation |
| `src/lib/shared/games/singles-training/state.ts` | Apply/revert dart, dead/complete checks |
| `src/lib/shared/games/singles-training/summary.ts` | Build `SinglesTrainingSummary` |
| `src/lib/shared/games/singles-training/stats.ts` | Apply terminal game to lifetime stats |
| `src/lib/shared/games/singles-training/validation.ts` | Settings validation |
| `src/lib/server/data/singles-training-session.ts` | Blob CRUD for active session |
| `src/lib/server/data/player-singles-training-stats.ts` | Blob CRUD for lifetime stats |
| `src/pages/api/games/singles-training/session.ts` | POST/GET/DELETE session |
| `src/pages/api/games/singles-training/session/dart.ts` | POST dart |
| `src/pages/api/games/singles-training/session/dart/last.ts` | DELETE undo |
| `src/pages/api/games/singles-training/session/play-again.ts` | POST new session from settings |
| `src/lib/client/alpine/games/singles-training.settings.ts` | Settings Alpine |
| `src/lib/client/alpine/games/singles-training.play.ts` | Play flow Alpine |
| `src/components/games/singles-training/*.astro` | UI components |
| `src/lib/shared/games/types.ts` | `SEED_GAMES` entry (`released: true`) |
| `src/lib/shared/games/codes.ts` | `"singles-training": "st"` |
| `src/lib/shared/games/components.ts` | Component registry |
| `src/pages/games.astro` | Games overview (auto via `getGameTypes`) |
| `src/pages/games/[game].astro` | Session load guard |
| `src/pages/games/settings-[game].astro` | Active session banner |
| `src/lib/client/alpine/app.factory.ts` | Alpine registration |

---

### Task 1: Constants, Settings & Session Types

**Files:**
- Create: `app/src/lib/shared/games/singles-training/constants.ts`
- Create: `app/src/lib/shared/games/singles-training/settings.ts`
- Create: `app/src/lib/shared/games/singles-training/session.ts`
- Test: `app/tests/lib/shared/games/singles-training/constants.test.ts`
- Test: `app/tests/lib/shared/games/singles-training/session.test.ts`

- [ ] **Step 1: Write the failing constants test**

```typescript
// app/tests/lib/shared/games/singles-training/constants.test.ts
import { describe, it, expect } from "vitest";
import {
  DARTS_PER_VISIT,
  TARGET_COUNT,
  DEFAULT_DIRECTION,
  DEFAULT_MODE,
  DEFAULT_SCORING,
} from "@lib/shared/games/singles-training/constants";

describe("singles-training constants", () => {
  it("exports expected defaults", () => {
    expect(DARTS_PER_VISIT).toBe(3);
    expect(TARGET_COUNT).toBe(21);
    expect(DEFAULT_DIRECTION).toBe("low-to-high");
    expect(DEFAULT_MODE).toBe("normal");
    expect(DEFAULT_SCORING).toBe("traditional");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/constants.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/games/singles-training/constants.ts
export const DARTS_PER_VISIT = 3;
export const TARGET_COUNT = 21;
export const DEFAULT_DIRECTION = "low-to-high" as const;
export const DEFAULT_MODE = "normal" as const;
export const DEFAULT_SCORING = "traditional" as const;
```

```typescript
// app/src/lib/shared/games/singles-training/settings.ts
export type SinglesTrainingDirection = "low-to-high" | "high-to-low" | "random";
export type SinglesTrainingMode = "normal" | "hard" | "extreme";
export type SinglesTrainingScoring = "traditional" | "uniform";

export type SinglesTrainingSettings = {
  direction: SinglesTrainingDirection;
  mode: SinglesTrainingMode;
  scoring: SinglesTrainingScoring;
};
```

```typescript
// app/src/lib/shared/games/singles-training/session.ts
import type { SinglesTrainingSettings } from "@lib/shared/games/singles-training/settings";
import type { DartRecord } from "@lib/shared/games/singles-training/dart";

export type SinglesTrainingTarget = number | "bull";
export type SinglesTrainingGameStatus = "active" | "dead" | "completed";

export type SegmentCounts = {
  miss: number;
  single: number;
  double: number;
  triple: number;
};

export type SinglesTrainingGameState = {
  status: SinglesTrainingGameStatus;
  currentTargetIndex: number;
  currentDartInVisit: 0 | 1 | 2;
  score: number;
  segmentCounts: SegmentCounts;
};

export type SinglesTrainingSession = {
  slug: "singles-training";
  settings: SinglesTrainingSettings;
  targetSequence: SinglesTrainingTarget[];
  state: SinglesTrainingGameState;
  dartHistory: DartRecord[];
  createdAt: string;
  updatedAt: string;
};

export function createEmptySegmentCounts(): SegmentCounts {
  return { miss: 0, single: 0, double: 0, triple: 0 };
}

export function isSinglesTrainingSession(value: unknown): value is SinglesTrainingSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const state = record.state;
  return (
    record.slug === "singles-training" &&
    state !== null &&
    typeof state === "object" &&
    Array.isArray(record.targetSequence) &&
    Array.isArray(record.dartHistory) &&
    record.settings !== null &&
    typeof record.settings === "object"
  );
}
```

Create stub `dart.ts` with minimal `DartRecord` type so session.ts compiles:

```typescript
// app/src/lib/shared/games/singles-training/dart.ts
export type DartOutcomeType = "miss" | "single" | "double" | "triple";
export type DartOutcome = { type: DartOutcomeType };

export type DartRecord = {
  targetIndex: number;
  dartInVisit: 0 | 1 | 2;
  outcome: DartOutcome;
  points: number;
};
```

- [ ] **Step 4: Write session guard test**

```typescript
// app/tests/lib/shared/games/singles-training/session.test.ts
import { describe, it, expect } from "vitest";
import { isSinglesTrainingSession } from "@lib/shared/games/singles-training/session";

describe("isSinglesTrainingSession", () => {
  it("returns true for valid session shape", () => {
    const session = {
      slug: "singles-training",
      settings: { direction: "low-to-high", mode: "normal", scoring: "traditional" },
      targetSequence: [1, 2, "bull"],
      state: {
        status: "active",
        currentTargetIndex: 0,
        currentDartInVisit: 0,
        score: 0,
        segmentCounts: { miss: 0, single: 0, double: 0, triple: 0 },
      },
      dartHistory: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(isSinglesTrainingSession(session)).toBe(true);
  });

  it("returns false for wrong slug", () => {
    expect(isSinglesTrainingSession({ slug: "score-training" })).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/`  
Expected: PASS

---

### Task 2: Target Sequence Builder

**Files:**
- Create: `app/src/lib/shared/games/singles-training/target-sequence.ts`
- Test: `app/tests/lib/shared/games/singles-training/target-sequence.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// app/tests/lib/shared/games/singles-training/target-sequence.test.ts
import { describe, it, expect } from "vitest";
import {
  buildTargetSequence,
  ALL_TARGETS,
} from "@lib/shared/games/singles-training/target-sequence";

describe("buildTargetSequence", () => {
  it("low-to-high returns 1..20 then bull", () => {
    const seq = buildTargetSequence("low-to-high");
    expect(seq).toEqual([...Array.from({ length: 20 }, (_, i) => i + 1), "bull"]);
  });

  it("high-to-low returns bull then 20..1", () => {
    const seq = buildTargetSequence("high-to-low");
    expect(seq[0]).toBe("bull");
    expect(seq[1]).toBe(20);
    expect(seq[20]).toBe(1);
  });

  it("random returns all 21 targets", () => {
    const seq = buildTargetSequence("random", () => 0.5);
    expect(seq).toHaveLength(21);
    expect(new Set(seq)).toEqual(new Set(ALL_TARGETS));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/target-sequence.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// app/src/lib/shared/games/singles-training/target-sequence.ts
import type { SinglesTrainingDirection } from "@lib/shared/games/singles-training/settings";
import type { SinglesTrainingTarget } from "@lib/shared/games/singles-training/session";

export const ALL_TARGETS: SinglesTrainingTarget[] = [
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  "bull",
];

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildTargetSequence(
  direction: SinglesTrainingDirection,
  random: () => number = Math.random,
): SinglesTrainingTarget[] {
  if (direction === "low-to-high") return [...ALL_TARGETS];
  if (direction === "high-to-low") return ["bull", ...Array.from({ length: 20 }, (_, i) => 20 - i)];
  return shuffle(ALL_TARGETS, random);
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/target-sequence.test.ts`  
Expected: PASS

---

### Task 3: Dart Points, Labels & Outcome Validation

**Files:**
- Modify: `app/src/lib/shared/games/singles-training/dart.ts`
- Test: `app/tests/lib/shared/games/singles-training/dart.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// app/tests/lib/shared/games/singles-training/dart.test.ts
import { describe, it, expect } from "vitest";
import {
  calculateDartPoints,
  formatDartOutcomeLabel,
  isValidOutcomeForTarget,
} from "@lib/shared/games/singles-training/dart";

describe("calculateDartPoints", () => {
  it("traditional scoring", () => {
    expect(calculateDartPoints({ type: "single" }, "traditional")).toBe(1);
    expect(calculateDartPoints({ type: "double" }, "traditional")).toBe(2);
    expect(calculateDartPoints({ type: "triple" }, "traditional")).toBe(3);
    expect(calculateDartPoints({ type: "miss" }, "traditional")).toBe(0);
  });

  it("uniform scoring", () => {
    expect(calculateDartPoints({ type: "triple" }, "uniform")).toBe(1);
    expect(calculateDartPoints({ type: "miss" }, "uniform")).toBe(0);
  });
});

describe("formatDartOutcomeLabel", () => {
  it("formats number target outcomes", () => {
    expect(formatDartOutcomeLabel(10, { type: "single" })).toBe("S10");
    expect(formatDartOutcomeLabel(10, { type: "miss" })).toBe("Miss");
  });

  it("formats bull target outcomes", () => {
    expect(formatDartOutcomeLabel("bull", { type: "single" })).toBe("25");
    expect(formatDartOutcomeLabel("bull", { type: "double" })).toBe("Bull");
  });
});

describe("isValidOutcomeForTarget", () => {
  it("rejects triple on bull", () => {
    expect(isValidOutcomeForTarget("bull", { type: "triple" })).toBe(false);
  });

  it("accepts single on bull", () => {
    expect(isValidOutcomeForTarget("bull", { type: "single" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/dart.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// app/src/lib/shared/games/singles-training/dart.ts
import type { SinglesTrainingScoring } from "@lib/shared/games/singles-training/settings";
import type { SinglesTrainingTarget } from "@lib/shared/games/singles-training/session";

export type DartOutcomeType = "miss" | "single" | "double" | "triple";
export type DartOutcome = { type: DartOutcomeType };

export type DartRecord = {
  targetIndex: number;
  dartInVisit: 0 | 1 | 2;
  outcome: DartOutcome;
  points: number;
};

export function calculateDartPoints(
  outcome: DartOutcome,
  scoring: SinglesTrainingScoring,
): number {
  if (outcome.type === "miss") return 0;
  if (scoring === "uniform") return 1;
  if (outcome.type === "single") return 1;
  if (outcome.type === "double") return 2;
  return 3;
}

export function isHit(outcome: DartOutcome): boolean {
  return outcome.type !== "miss";
}

export function isValidOutcomeForTarget(
  target: SinglesTrainingTarget,
  outcome: DartOutcome,
): boolean {
  if (target === "bull") {
    return outcome.type === "miss" || outcome.type === "single" || outcome.type === "double";
  }
  return (
    outcome.type === "miss" ||
    outcome.type === "single" ||
    outcome.type === "double" ||
    outcome.type === "triple"
  );
}

export function formatDartOutcomeLabel(
  target: SinglesTrainingTarget,
  outcome: DartOutcome,
): string {
  if (outcome.type === "miss") return "Miss";
  if (target === "bull") {
    return outcome.type === "single" ? "25" : "Bull";
  }
  const prefix = outcome.type === "single" ? "S" : outcome.type === "double" ? "D" : "T";
  return `${prefix}${target}`;
}

export function buildDartRecord(
  targetIndex: number,
  dartInVisit: 0 | 1 | 2,
  outcome: DartOutcome,
  scoring: SinglesTrainingScoring,
): DartRecord {
  return {
    targetIndex,
    dartInVisit,
    outcome,
    points: calculateDartPoints(outcome, scoring),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/dart.test.ts`  
Expected: PASS

---

### Task 4: Game State — Apply & Revert Dart

**Files:**
- Create: `app/src/lib/shared/games/singles-training/state.ts`
- Test: `app/tests/lib/shared/games/singles-training/state.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// app/tests/lib/shared/games/singles-training/state.test.ts
import { describe, it, expect } from "vitest";
import {
  createInitialGameState,
  applyDartToSession,
  revertLastDart,
  getMinimumHitsForMode,
} from "@lib/shared/games/singles-training/state";
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";

function baseSession(mode: "normal" | "hard" | "extreme"): SinglesTrainingSession {
  return {
    slug: "singles-training",
    settings: { direction: "low-to-high", mode, scoring: "traditional" },
    targetSequence: [10, 11, "bull"],
    state: createInitialGameState(),
    dartHistory: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("applyDartToSession", () => {
  it("advances dart index within visit", () => {
    const session = baseSession("normal");
    const next = applyDartToSession(session, { type: "single" });
    expect(next.state.currentDartInVisit).toBe(1);
    expect(next.state.score).toBe(1);
  });

  it("hard mode sets dead after 3 misses on target", () => {
    let session = baseSession("hard");
    session = applyDartToSession(session, { type: "miss" });
    session = applyDartToSession(session, { type: "miss" });
    session = applyDartToSession(session, { type: "miss" });
    expect(session.state.status).toBe("dead");
  });

  it("normal mode advances target after 3 darts", () => {
    let session = baseSession("normal");
    session = applyDartToSession(session, { type: "miss" });
    session = applyDartToSession(session, { type: "miss" });
    session = applyDartToSession(session, { type: "miss" });
    expect(session.state.currentTargetIndex).toBe(1);
    expect(session.state.currentDartInVisit).toBe(0);
  });
});

describe("revertLastDart", () => {
  it("undoes last dart and recalculates score", () => {
    let session = baseSession("normal");
    session = applyDartToSession(session, { type: "triple" });
    session = revertLastDart(session);
    expect(session.dartHistory).toHaveLength(0);
    expect(session.state.score).toBe(0);
  });
});

describe("getMinimumHitsForMode", () => {
  it("returns correct minimums", () => {
    expect(getMinimumHitsForMode("normal")).toBe(0);
    expect(getMinimumHitsForMode("hard")).toBe(1);
    expect(getMinimumHitsForMode("extreme")).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/state.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// app/src/lib/shared/games/singles-training/state.ts
import { DARTS_PER_VISIT, TARGET_COUNT } from "@lib/shared/games/singles-training/constants";
import {
  buildDartRecord,
  isHit,
  type DartOutcome,
} from "@lib/shared/games/singles-training/dart";
import type { SinglesTrainingMode } from "@lib/shared/games/singles-training/settings";
import {
  createEmptySegmentCounts,
  type SinglesTrainingGameState,
  type SinglesTrainingSession,
} from "@lib/shared/games/singles-training/session";

export function getMinimumHitsForMode(mode: SinglesTrainingMode): number {
  if (mode === "hard") return 1;
  if (mode === "extreme") return 2;
  return 0;
}

export function createInitialGameState(): SinglesTrainingGameState {
  return {
    status: "active",
    currentTargetIndex: 0,
    currentDartInVisit: 0,
    score: 0,
    segmentCounts: createEmptySegmentCounts(),
  };
}

function countHitsInCurrentVisit(session: SinglesTrainingSession): number {
  const { currentTargetIndex, currentDartInVisit } = session.state;
  return session.dartHistory.filter(
    (d) => d.targetIndex === currentTargetIndex && isHit(d.outcome),
  ).length;
}

function advanceAfterVisit(session: SinglesTrainingSession): SinglesTrainingSession {
  const nextTargetIndex = session.state.currentTargetIndex + 1;
  if (nextTargetIndex >= TARGET_COUNT) {
    return {
      ...session,
      state: { ...session.state, status: "completed", currentDartInVisit: 0 },
    };
  }
  return {
    ...session,
    state: {
      ...session.state,
      currentTargetIndex: nextTargetIndex,
      currentDartInVisit: 0,
    },
  };
}

export function applyDartToSession(
  session: SinglesTrainingSession,
  outcome: DartOutcome,
): SinglesTrainingSession {
  const { currentTargetIndex, currentDartInVisit } = session.state;
  const dartInVisit = currentDartInVisit as 0 | 1 | 2;
  const record = buildDartRecord(
    currentTargetIndex,
    dartInVisit,
    outcome,
    session.settings.scoring,
  );

  const segmentCounts = { ...session.state.segmentCounts };
  segmentCounts[record.outcome.type] += 1;

  let next: SinglesTrainingSession = {
    ...session,
    dartHistory: [...session.dartHistory, record],
    state: {
      ...session.state,
      score: session.state.score + record.points,
      segmentCounts,
      currentDartInVisit: ((currentDartInVisit + 1) % DARTS_PER_VISIT) as 0 | 1 | 2,
    },
  };

  const visitComplete = currentDartInVisit === DARTS_PER_VISIT - 1;
  if (!visitComplete) return next;

  const hits = countHitsInCurrentVisit(next);
  const minimum = getMinimumHitsForMode(next.settings.mode);
  if (hits < minimum) {
    return { ...next, state: { ...next.state, status: "dead" } };
  }

  return advanceAfterVisit(next);
}

export function revertLastDart(session: SinglesTrainingSession): SinglesTrainingSession {
  if (session.dartHistory.length === 0) return session;

  const removed = session.dartHistory[session.dartHistory.length - 1];
  const dartHistory = session.dartHistory.slice(0, -1);
  const segmentCounts = { ...session.state.segmentCounts };
  segmentCounts[removed.outcome.type] -= 1;

  return {
    ...session,
    dartHistory,
    state: {
      status: "active",
      currentTargetIndex: removed.targetIndex,
      currentDartInVisit: removed.dartInVisit,
      score: session.state.score - removed.points,
      segmentCounts,
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/state.test.ts`  
Expected: PASS

---

### Task 5: Summary & Stats

**Files:**
- Create: `app/src/lib/shared/games/singles-training/summary.ts`
- Create: `app/src/lib/shared/games/singles-training/stats.ts`
- Test: `app/tests/lib/shared/games/singles-training/summary.test.ts`
- Test: `app/tests/lib/shared/games/singles-training/stats.test.ts`

- [ ] **Step 1: Write failing summary test**

```typescript
// app/tests/lib/shared/games/singles-training/summary.test.ts
import { describe, it, expect } from "vitest";
import { buildSummary } from "@lib/shared/games/singles-training/summary";
import { createInitialGameState } from "@lib/shared/games/singles-training/state";

describe("buildSummary", () => {
  it("computes hit ratio and dart position rates", () => {
    const session = {
      slug: "singles-training" as const,
      settings: { direction: "low-to-high" as const, mode: "normal" as const, scoring: "traditional" as const },
      targetSequence: [10, 11],
      state: { ...createInitialGameState(), score: 4, status: "completed" as const },
      dartHistory: [
        { targetIndex: 0, dartInVisit: 0, outcome: { type: "single" as const }, points: 1 },
        { targetIndex: 0, dartInVisit: 1, outcome: { type: "miss" as const }, points: 0 },
        { targetIndex: 0, dartInVisit: 2, outcome: { type: "double" as const }, points: 2 },
        { targetIndex: 1, dartInVisit: 0, outcome: { type: "triple" as const }, points: 3 },
        { targetIndex: 1, dartInVisit: 1, outcome: { type: "miss" as const }, points: 0 },
        { targetIndex: 1, dartInVisit: 2, outcome: { type: "miss" as const }, points: 0 },
      ],
      createdAt: "", updatedAt: "",
    };
    const summary = buildSummary(session);
    expect(summary.hitRatio).toBeCloseTo(3 / 6);
    expect(summary.dartPositionSuccessRates[0]).toBeCloseTo(2 / 2);
    expect(summary.dartPositionSuccessRates[1]).toBeCloseTo(0 / 2);
    expect(summary.dartPositionSuccessRates[2]).toBeCloseTo(1 / 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/summary.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement summary and stats**

```typescript
// app/src/lib/shared/games/singles-training/summary.ts
import { DARTS_PER_VISIT } from "@lib/shared/games/singles-training/constants";
import { isHit } from "@lib/shared/games/singles-training/dart";
import type { SegmentCounts, SinglesTrainingSession } from "@lib/shared/games/singles-training/session";

export type SinglesTrainingSummary = {
  status: "completed" | "dead";
  score: number;
  segmentCounts: SegmentCounts;
  hitRatio: number;
  dartPositionSuccessRates: [number, number, number];
  targetsCompleted: number;
  dartsThrown: number;
};

export function buildSummary(session: SinglesTrainingSession): SinglesTrainingSummary {
  const dartsThrown = session.dartHistory.length;
  const hits = session.dartHistory.filter((d) => isHit(d.outcome)).length;
  const hitRatio = dartsThrown === 0 ? 0 : hits / dartsThrown;

  const positionHits: [number, number, number] = [0, 0, 0];
  const positionAttempts: [number, number, number] = [0, 0, 0];

  for (const dart of session.dartHistory) {
    positionAttempts[dart.dartInVisit] += 1;
    if (isHit(dart.outcome)) positionHits[dart.dartInVisit] += 1;
  }

  const dartPositionSuccessRates: [number, number, number] = [0, 1, 2].map((i) =>
    positionAttempts[i] === 0 ? 0 : positionHits[i] / positionAttempts[i],
  ) as [number, number, number];

  const targetsCompleted =
    session.state.status === "completed"
      ? session.targetSequence.length
      : Math.floor(dartsThrown / DARTS_PER_VISIT);

  return {
    status: session.state.status === "dead" ? "dead" : "completed",
    score: session.state.score,
    segmentCounts: session.state.segmentCounts,
    hitRatio,
    dartPositionSuccessRates,
    targetsCompleted,
    dartsThrown,
  };
}
```

```typescript
// app/src/lib/shared/games/singles-training/stats.ts
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";
import { isHit } from "@lib/shared/games/singles-training/dart";
import { buildSummary } from "@lib/shared/games/singles-training/summary";

export type PlayerSinglesTrainingStats = {
  gamesCompleted: number;
  gamesFailed: number;
  totalDartsThrown: number;
  totalHits: number;
  totalScore: number;
  dartPositionHits: [number, number, number];
  dartPositionAttempts: [number, number, number];
  bestHitRatio: number;
  bestScore: number;
};

export function createEmptySinglesTrainingStats(): PlayerSinglesTrainingStats {
  return {
    gamesCompleted: 0,
    gamesFailed: 0,
    totalDartsThrown: 0,
    totalHits: 0,
    totalScore: 0,
    dartPositionHits: [0, 0, 0],
    dartPositionAttempts: [0, 0, 0],
    bestHitRatio: 0,
    bestScore: 0,
  };
}

export function applyGameCompletionToStats(
  stats: PlayerSinglesTrainingStats,
  session: SinglesTrainingSession,
): void {
  const summary = buildSummary(session);
  if (summary.status === "completed") stats.gamesCompleted += 1;
  if (summary.status === "dead") stats.gamesFailed += 1;

  stats.totalDartsThrown += summary.dartsThrown;
  stats.totalScore += summary.score;
  const hits = session.dartHistory.filter((d) => isHit(d.outcome)).length;
  stats.totalHits += hits;

  for (let i = 0; i < 3; i += 1) {
    const attempts = session.dartHistory.filter((d) => d.dartInVisit === i).length;
    const positionHits = session.dartHistory.filter(
      (d) => d.dartInVisit === i && isHit(d.outcome),
    ).length;
    stats.dartPositionAttempts[i] += attempts;
    stats.dartPositionHits[i] += positionHits;
  }

  if (summary.hitRatio > stats.bestHitRatio) stats.bestHitRatio = summary.hitRatio;
  if (summary.score > stats.bestScore) stats.bestScore = summary.score;
}
```

- [ ] **Step 4: Write stats test and run all**

```typescript
// app/tests/lib/shared/games/singles-training/stats.test.ts
import { describe, it, expect } from "vitest";
import {
  createEmptySinglesTrainingStats,
  applyGameCompletionToStats,
} from "@lib/shared/games/singles-training/stats";
import { createInitialGameState } from "@lib/shared/games/singles-training/state";

describe("applyGameCompletionToStats", () => {
  it("increments gamesFailed on dead session", () => {
    const stats = createEmptySinglesTrainingStats();
    const session = {
      slug: "singles-training" as const,
      settings: { direction: "low-to-high" as const, mode: "hard" as const, scoring: "traditional" as const },
      targetSequence: [10],
      state: { ...createInitialGameState(), status: "dead" as const },
      dartHistory: [
        { targetIndex: 0, dartInVisit: 0, outcome: { type: "miss" as const }, points: 0 },
        { targetIndex: 0, dartInVisit: 1, outcome: { type: "miss" as const }, points: 0 },
        { targetIndex: 0, dartInVisit: 2, outcome: { type: "miss" as const }, points: 0 },
      ],
      createdAt: "", updatedAt: "",
    };
    applyGameCompletionToStats(stats, session);
    expect(stats.gamesFailed).toBe(1);
    expect(stats.gamesCompleted).toBe(0);
  });
});
```

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/summary.test.ts tests/lib/shared/games/singles-training/stats.test.ts`  
Expected: PASS

---

### Task 6: Settings Validation & Error Codes

**Files:**
- Create: `app/src/lib/shared/games/singles-training/validation.ts`
- Modify: `app/src/lib/shared/constants/errors.constants.ts`
- Test: `app/tests/lib/shared/games/singles-training/validation.test.ts`

- [ ] **Step 1: Add error codes**

```typescript
// Add to app/src/lib/shared/constants/errors.constants.ts MessageCode enum:
INVALID_DART_OUTCOME = "INVALID_DART_OUTCOME",
NO_DARTS_TO_UNDO = "NO_DARTS_TO_UNDO",
```

- [ ] **Step 2: Write failing validation test**

```typescript
// app/tests/lib/shared/games/singles-training/validation.test.ts
import { describe, it, expect } from "vitest";
import { validateSinglesTrainingSettings } from "@lib/shared/games/singles-training/validation";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("validateSinglesTrainingSettings", () => {
  it("accepts valid settings", () => {
    const result = validateSinglesTrainingSettings({
      direction: "random",
      mode: "extreme",
      scoring: "uniform",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.mode).toBe("extreme");
    }
  });

  it("rejects invalid direction", () => {
    const result = validateSinglesTrainingSettings({
      direction: "sideways",
      mode: "normal",
      scoring: "traditional",
    });
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });
});
```

- [ ] **Step 3: Implement validation**

```typescript
// app/src/lib/shared/games/singles-training/validation.ts
import { MessageCode } from "@lib/shared/constants/errors.constants";
import type {
  SinglesTrainingDirection,
  SinglesTrainingMode,
  SinglesTrainingScoring,
  SinglesTrainingSettings,
} from "@lib/shared/games/singles-training/settings";
import {
  DEFAULT_DIRECTION,
  DEFAULT_MODE,
  DEFAULT_SCORING,
} from "@lib/shared/games/singles-training/constants";

const DIRECTIONS: SinglesTrainingDirection[] = ["low-to-high", "high-to-low", "random"];
const MODES: SinglesTrainingMode[] = ["normal", "hard", "extreme"];
const SCORINGS: SinglesTrainingScoring[] = ["traditional", "uniform"];

export type ValidateSettingsResult =
  | { valid: true; value: SinglesTrainingSettings }
  | { valid: false; code: typeof MessageCode.INVALID_GAME_SETTINGS };

export function validateSinglesTrainingSettings(
  raw: Record<string, unknown>,
): ValidateSettingsResult {
  const direction = raw.direction ?? DEFAULT_DIRECTION;
  const mode = raw.mode ?? DEFAULT_MODE;
  const scoring = raw.scoring ?? DEFAULT_SCORING;

  if (!DIRECTIONS.includes(direction as SinglesTrainingDirection)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }
  if (!MODES.includes(mode as SinglesTrainingMode)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }
  if (!SCORINGS.includes(scoring as SinglesTrainingScoring)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  return {
    valid: true,
    value: {
      direction: direction as SinglesTrainingDirection,
      mode: mode as SinglesTrainingMode,
      scoring: scoring as SinglesTrainingScoring,
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/validation.test.ts`  
Expected: PASS

---

### Task 7: Session Data Layer

**Files:**
- Create: `app/src/lib/server/data/singles-training-session.ts`
- Create: `app/src/lib/server/data/player-singles-training-stats.ts`
- Test: `app/tests/lib/server/data/singles-training-session.test.ts`

Mirror `score-training-session.ts` pattern: `getStore("game-sessions")`, key `{userId}:singles-training`, `createSinglesTrainingSession` calls `buildTargetSequence(settings.direction)` and `createInitialGameState()`.

- [ ] **Step 1: Write failing session data test** (mock `@netlify/blobs` like existing score-training session tests)

- [ ] **Step 2: Implement `singles-training-session.ts` and `player-singles-training-stats.ts`**

- [ ] **Step 3: Run tests**

Run: `cd app && npm test -- tests/lib/server/data/singles-training-session.test.ts`  
Expected: PASS

---

### Task 8: API — Session CRUD

**Files:**
- Create: `app/src/pages/api/games/singles-training/session.ts`
- Modify: `app/src/lib/shared/api/types.ts`
- Test: `app/tests/api/games/singles-training/session.test.ts`

- [ ] **Step 1: Add API type**

```typescript
// app/src/lib/shared/api/types.ts
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";
import type { SinglesTrainingSummary } from "@lib/shared/games/singles-training/summary";

export type SinglesTrainingSessionSuccess = {
  ok: true;
  session: SinglesTrainingSession;
  terminal?: boolean;
  summary?: SinglesTrainingSummary;
};
```

Add to `ApiSuccess` union.

- [ ] **Step 2: Write failing API test** (mirror `tests/api/games/score-training/session.test.ts`)

- [ ] **Step 3: Implement `session.ts`** — POST validates settings, rejects `SESSION_EXISTS`, GET returns active session, DELETE abandons session

- [ ] **Step 4: Run tests**

Run: `cd app && npm test -- tests/api/games/singles-training/session.test.ts`  
Expected: PASS

---

### Task 9: API — Dart POST

**Files:**
- Create: `app/src/pages/api/games/singles-training/session/dart.ts`
- Test: `app/tests/api/games/singles-training/dart.test.ts`

- [ ] **Step 1: Write failing tests covering:**
- Valid dart updates session
- Invalid outcome for target → `INVALID_DART_OUTCOME`
- Hard mode 3 misses → `terminal: true`, `summary`, session deleted
- Normal mode completes all targets → `terminal: true`, stats saved

- [ ] **Step 2: Implement dart POST**

```typescript
// Payload: { outcome: { type: "single" | "double" | "triple" | "miss" } }
// On terminal: apply stats, delete session, return summary
// Else: save session
```

- [ ] **Step 3: Run tests**

Run: `cd app && npm test -- tests/api/games/singles-training/dart.test.ts`  
Expected: PASS

---

### Task 10: API — Dart Undo & Play Again

**Files:**
- Create: `app/src/pages/api/games/singles-training/session/dart/last.ts`
- Create: `app/src/pages/api/games/singles-training/session/play-again.ts`
- Test: `app/tests/api/games/singles-training/dart-last.test.ts`
- Test: `app/tests/api/games/singles-training/play-again.test.ts`

- [ ] **Step 1: Write failing undo test** — reverts last dart; empty history → `NO_DARTS_TO_UNDO`; reverting from dead restores `active`

- [ ] **Step 2: Write failing play-again test** — creates new session with same settings; random direction gets new sequence

- [ ] **Step 3: Implement both routes**

Play-again: read settings from request body or from terminal session before delete; call `createSinglesTrainingSession`.

- [ ] **Step 4: Run tests**

Run: `cd app && npm test -- tests/api/games/singles-training/`  
Expected: PASS

---

### Task 11: Settings Alpine & Form

**Files:**
- Create: `app/src/components/games/singles-training/SettingsForm.astro`
- Create: `app/src/components/games/singles-training/SinglesTrainingSettingsShell.astro`
- Create: `app/src/lib/client/alpine/games/singles-training.settings.ts`
- Test: `app/tests/lib/client/alpine/games/singles-training.settings.test.ts`

- [ ] **Step 1: SettingsForm** — 3 radio fieldsets: Direction, Mode, Scoring (defaults from constants)

- [ ] **Step 2: Settings shell** — mirror `ScoreTrainingSettingsShell.astro` with resume/abandon banner

- [ ] **Step 3: Alpine settings** — POST `/api/games/singles-training/session`, redirect to `/games/singles-training`

- [ ] **Step 4: Write settings test and run**

Run: `cd app && npm test -- tests/lib/client/alpine/games/singles-training.settings.test.ts`  
Expected: PASS

---

### Task 12: Play Alpine Controller

**Files:**
- Create: `app/src/lib/client/alpine/games/singles-training.play.ts`
- Test: `app/tests/lib/client/alpine/games/singles-training.play.test.ts`

- [ ] **Step 1: Write failing play tests covering:**
- `currentTarget` computed from `targetSequence[currentTargetIndex]`
- `visitDartLabels` array for dart row
- `submitDart(outcome)` POSTs and updates session
- Terminal response shows summary
- `undoDart()` DELETEs last dart
- `playAgain()` POSTs play-again

- [ ] **Step 2: Implement `singlesTrainingPlay(initialSession)`**

Key getters:
```typescript
get currentTarget() {
  return this.session.targetSequence[this.session.state.currentTargetIndex];
}
get isBullTarget() {
  return this.currentTarget === "bull";
}
get visitDartLabels() {
  // Map darts for current target from dartHistory + empty slots as "-"
}
```

- [ ] **Step 3: Run tests**

Run: `cd app && npm test -- tests/lib/client/alpine/games/singles-training.play.test.ts`  
Expected: PASS

---

### Task 13: Play UI Components

**Files:**
- Create: `app/src/components/games/singles-training/ScorePanel.astro`
- Create: `app/src/components/games/singles-training/TargetLabel.astro`
- Create: `app/src/components/games/singles-training/DartInput.astro`
- Create: `app/src/components/games/singles-training/Summary.astro`
- Create: `app/src/components/games/singles-training/Play.astro`

- [ ] **Step 1: ScorePanel** — port layout from `test.astro` lines 9–19; bind `session.state.score` and `session.state.segmentCounts`

- [ ] **Step 2: TargetLabel** — `Your target is <span x-text="targetDisplay">`

- [ ] **Step 3: DartInput** — dart row + conditional bull/number grids; `x-show="!showSummary"`

```astro
<!-- Number target: S{n} D{n} T{n} row + Back/Miss row -->
<!-- Bull target: Single/Bull row + Back/Miss row (2x2) -->
```

- [ ] **Step 4: Summary** — end screen with all stats + "Do you want to play again?" Yes/No

- [ ] **Step 5: Play.astro** — wire header leave button, components, `x-data={`singlesTrainingPlay(${sessionJson})`}`

---

### Task 14: Game Registration & Routing

**Files:**
- Modify: `app/src/lib/shared/games/types.ts`
- Modify: `app/src/lib/shared/games/codes.ts`
- Modify: `app/src/lib/shared/games/components.ts`
- Modify: `app/src/lib/client/alpine/app.factory.ts`
- Modify: `app/src/pages/games/[game].astro`
- Modify: `app/src/pages/games/settings-[game].astro`
- Test: `app/tests/lib/shared/games/types.test.ts`
- Test: `app/tests/lib/shared/games/components.test.ts`
- Test: `app/tests/lib/shared/games/codes.test.ts`

- [ ] **Step 1: Add SEED_GAMES entry**

```typescript
{
  slug: "singles-training",
  displayName: "Singles Training",
  sortOrder: 5,
  enabled: true,
  released: true,
},
```

- [ ] **Step 2: Add game code**

```typescript
// codes.ts
"singles-training": "st",
```

- [ ] **Step 3: Register components in `components.ts`**

- [ ] **Step 4: Register Alpine in `app.factory.ts`**

```typescript
import { singlesTrainingSettings } from "@lib/client/alpine/games/singles-training.settings";
import { singlesTrainingPlay } from "@lib/client/alpine/games/singles-training.play";
Alpine.data("singlesTrainingSettings", singlesTrainingSettings);
Alpine.data("singlesTrainingPlay", singlesTrainingPlay);
```

- [ ] **Step 5: Wire `[game].astro`** — load `getSinglesTrainingSession`, redirect if missing, render Play with session

- [ ] **Step 6: Wire `settings-[game].astro`** — active session check, `SinglesTrainingSettingsShell`

- [ ] **Step 7: Update registration tests and run**

Run: `cd app && npm test -- tests/lib/shared/games/`  
Expected: PASS

---

### Task 15: Games Overview Page

**Files:**
- Modify: `app/tests/lib/shared/games/types.test.ts`
- Modify: `app/tests/lib/server/data/games.test.ts`
- Modify: `app/tests/api/games/index.test.ts`
- Verify: `app/src/pages/games.astro` (no code change required)

The games overview at `/games` renders all games from `getGameTypes()` where `enabled && released`. Adding `singles-training` to `SEED_GAMES` with `released: true` (Task 14) is sufficient for it to appear on the overview page automatically.

- [ ] **Step 1: Add types test**

```typescript
// app/tests/lib/shared/games/types.test.ts
it("includes singles-training as released", () => {
  expect(SEED_GAMES).toContainEqual({
    slug: "singles-training",
    displayName: "Singles Training",
    sortOrder: 5,
    enabled: true,
    released: true,
  });
});
```

- [ ] **Step 2: Add games data test**

```typescript
// app/tests/lib/server/data/games.test.ts
it("getGameTypes includes singles-training", async () => {
    // mock catalog with SEED_GAMES
    const games = await getGameTypes();
    expect(games.map((g) => g.slug)).toContain("singles-training");
});
```

- [ ] **Step 3: Add API catalog test**

```typescript
// app/tests/api/games/index.test.ts
it("returns singles-training in catalog", async () => {
    mockGetGameTypes.mockResolvedValue([
      { slug: "singles-training", displayName: "Singles Training", sortOrder: 5, enabled: true, released: true },
    ]);
    // assert response includes singles-training
});
```

- [ ] **Step 4: Run tests**

Run: `cd app && npm test -- tests/lib/shared/games/types.test.ts tests/lib/server/data/games.test.ts tests/api/games/index.test.ts`  
Expected: PASS

---

### Task 16: Assembly Test & Final Verification

**Files:**
- Create: `app/tests/pages/singles-training-play-assembly.test.ts`

- [ ] **Step 1: Write assembly test** (mirror `score-training-play-assembly.test.ts`)

```typescript
// app/tests/pages/singles-training-play-assembly.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("singles-training play assembly", () => {
  it("Play.astro wires singlesTrainingPlay", () => {
    const source = readFileSync(
      resolve("src/components/games/singles-training/Play.astro"),
      "utf8",
    );
    expect(source).toContain("x-data={`singlesTrainingPlay(");
    expect(source).toContain("ScorePanel");
    expect(source).toContain("DartInput");
    expect(source).toContain("Summary");
  });

  it("registers singlesTrainingPlay in alpine app factory", () => {
    const source = readFileSync(resolve("src/lib/client/alpine/app.factory.ts"), "utf8");
    expect(source).toContain('Alpine.data("singlesTrainingPlay", singlesTrainingPlay);');
  });

  it("games.astro uses getGameTypes for overview", () => {
    const source = readFileSync(resolve("src/pages/games.astro"), "utf8");
    expect(source).toContain("getGameTypes");
    expect(source).toContain("GameCard");
  });
});
```

- [ ] **Step 2: Run full verification gate**

```bash
cd app
npm run check
npm test
npm run build
```

Expected: all exit 0
