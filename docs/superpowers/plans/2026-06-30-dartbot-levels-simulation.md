# DartBot Levels & Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task subagent requirements (all mandatory):**
>
> 1. **test-driven-development** — for any task that writes or changes code
> 2. **verification-before-completion** — run the per-task verification gate before marking the task done; no completion claims without fresh command output

**Goal:** Replace hit-accuracy throw model with per-level fixed outcome distributions (levels 1–10), player-parity checkout replanning via `getCheckoutHint`, and soft set-level stat convergence.

**Architecture:** Split `lib/shared/dartbot/` into data (`level-profiles.ts`, `interpolate-levels.ts`) and throw engines (`scoring-throw`, `setup-throw`, `double-throw`). `simulateVisit` replans from hint after every dart. Set running stats live on `FiveOhOneBotState`; convergence nudges bucket weights only when set bands are breached. Checkout JSON knowledge retained for 131–170 setup zone only.

**Tech Stack:** TypeScript, Vitest, existing `lib/shared/darts` checkout hints, Alpine 501 play glue

**Spec:** `docs/superpowers/specs/2026-06-30-dartbot-levels-simulation-design.md`
**Working directory:** `app/` (all commands run from here)

---

## Verification Gate (every task)

Scoped tests during Steps 2–4; before marking any task complete:

```bash
cd app && npm run check && npm test && npx fallow
```

---

## Final Verification Gate

```bash
cd app
npm run check
npm test
npm run lint
npx fallow
./scripts/audit-imports.sh
```

Add `./scripts/curl-verify-501.sh` only if 501 play UI wiring changes break SSR (slider max change alone does not require it).

---

## File Structure Overview

| File | Action | Responsibility |
| ---- | ------ | ---------------- |
| `src/lib/shared/dartbot/types.ts` | Modify | New `LevelProfile`, outcome types, `ConvergenceBias`, `SetRunningStats`, extended `SimulateVisitContext` |
| `src/lib/shared/dartbot/level-profiles.ts` | Create | `ANCHOR_PROFILES` (L1/L5/L10), `LEVEL_STAT_RANGES` (L1–10 explicit) |
| `src/lib/shared/dartbot/interpolate-levels.ts` | Create | Lerp outcome tables L2–4, L6–9; largest-remainder normalize |
| `src/lib/shared/dartbot/levels.ts` | Modify | `getSkillProfile(1–10)` delegates to `buildLevelProfile` |
| `src/lib/shared/dartbot/outcome-sample.ts` | Create | Weighted bucket sampling + hit-shift renormalization |
| `src/lib/shared/dartbot/stat-validation.ts` | Create | `isWithinStatBand` |
| `src/lib/shared/dartbot/scoring-throw.ts` | Create | Scoring visit distribution sampling |
| `src/lib/shared/dartbot/setup-throw.ts` | Create | Setup singles/trebles/bull sampling |
| `src/lib/shared/dartbot/checkout-hit-rate.ts` | Create | Per-dart double hit rate in checkout % range |
| `src/lib/shared/dartbot/double-throw.ts` | Create | Double finish with dynamic hit rate |
| `src/lib/shared/dartbot/convergence.ts` | Create | `computeConvergenceBias`, `applyHitShift` |
| `src/lib/shared/dartbot/set-stats.ts` | Create | Aggregate `SetRunningStats` from visit history |
| `src/lib/shared/dartbot/checkout-target.ts` | Create | `nextCheckoutTarget(remaining)` via `getCheckoutHint` |
| `src/lib/shared/dartbot/throw-engine.ts` | Modify | Dispatch by intent; remove `miss-resolver` |
| `src/lib/shared/dartbot/dart-bot.ts` | Modify | Per-dart replanning, convergence bias, remove `CheckoutPlanner` in checkout range |
| `src/lib/shared/dartbot/match-planner.ts` | Modify | Asymmetric leg targets from `threeDartAverage.deviation.leg` |
| `src/lib/shared/dartbot/statistics-engine.ts` | Modify | Range + deviation band validation |
| `src/lib/shared/dartbot/preview.ts` | Modify | Checkout % as `min–max%` range |
| `src/lib/shared/dartbot/segments.ts` | Modify | Export `boardNeighbors(base)` |
| `src/lib/shared/dartbot/miss-resolver.ts` | Delete | Replaced by distribution engines |
| `src/lib/shared/dartbot/route-engine.ts` | Delete | Replaced by `scoring-throw` |
| `src/lib/shared/darts/checkout-hints.data.ts` | Modify | 55 → `["15", "D20"]`; safer-single audit |
| `src/lib/shared/games/501/types.ts` | Modify | `setRunningStats` on `FiveOhOneBotState` |
| `src/lib/shared/games/501/bot-play.ts` | Modify | Pass bias + update set stats after visit |
| `src/lib/shared/games/501/state.ts` | Modify | Reset `setRunningStats` on new set |
| `src/lib/shared/games/501/session-factory.ts` | Modify | Init empty `setRunningStats` |
| `src/lib/shared/games/501/validation.ts` | Modify | `level <= 10` |
| `src/components/games/501/DartBotLevelSlider.astro` | Modify | `max="10"` |
| `src/lib/shared/dartbot/index.ts` | Modify | Export new public APIs; drop dead exports |
| `tests/lib/shared/dartbot/**` | Create/Modify | Per spec §12 |
| `AGENTS.md` | Modify | Level cap 10, dartbot file layout note |

**Keep (unchanged scope):** `checkout/` folder for 131–170 setup route evaluation; `strategy-engine.ts` intent logic (fix threshold to `level >= 8` per spec §10).

**Do not add:** DB tables, server API routes, UI convergence indicators.

---

### Task 1: Distribution Types

**Files:**
- Modify: `app/src/lib/shared/dartbot/types.ts`
- Test: `app/tests/lib/shared/dartbot/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type {
  DeviationBand,
  DoubleOutcomes,
  LevelProfile,
  StatRange,
} from "@lib/shared/dartbot/types";

describe("dartbot distribution types", () => {
  it("StatRange includes leg and set deviation bands", () => {
    const range: StatRange = {
      min: 30,
      max: 40,
      deviation: {
        leg: { below: 5, above: 5 },
        set: { below: 3, above: 3 },
      },
    };
    expect(range.deviation.leg.below).toBe(5);
  });

  it("DoubleOutcomes weights sum conceptually to 100", () => {
    const outcomes: DoubleOutcomes = {
      hit: 14,
      inside: 20,
      neighborSingle: 30,
      neighborDouble: 12,
      outside: 19,
      other: 5,
    };
    const sum = Object.values(outcomes).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/dartbot/types.test.ts`
Expected: FAIL — types not exported

- [ ] **Step 3: Replace types in `types.ts`**

Replace `LevelProfile` / remove `execution` and `checkout.successRate`. Add:

```ts
export type ScoringOutcomes = Record<string, number>;

export type SetupOutcomes = {
  hit: number;
  neighborSingle?: number;
  neighborTreble?: number;
  wrongRing: number;
  neighborWrongRing: number;
  outside: number;
  other: number;
};

export type BullSetupOutcomes = {
  hit: number;
  wrongRing: number;
  outside: number;
  other: number;
};

export type DoubleOutcomes = {
  hit: number;
  inside: number;
  neighborSingle: number;
  neighborDouble: number;
  outside: number;
  other: number;
};

export type DeviationBand = { below: number; above: number };

export type StatRange = {
  min: number;
  max: number;
  deviation: { leg: DeviationBand; set: DeviationBand };
};

export type ConvergenceConfig = {
  maxScoringHitShift: number;
  maxSetupHitShift: number;
  maxCheckoutHitShift: number;
  distanceScale: number;
};

export type LevelProfile = {
  level: number;
  threeDartAverage: StatRange;
  scoringAverage: StatRange;
  checkoutPercentage: { min: number; max: number };
  scoring: { aim: "S20" | "T20"; outcomes: ScoringOutcomes };
  setup: {
    singles: SetupOutcomes;
    trebles: SetupOutcomes;
    outerBull: BullSetupOutcomes;
    bull: BullSetupOutcomes;
  };
  doubles: { outcomes: DoubleOutcomes };
  convergence: ConvergenceConfig;
};

export type SkillProfile = LevelProfile;

export type ConvergenceBias = {
  scoringHitShift: number;
  setupHitShift: number;
  checkoutHitShift: number;
};

export type SetRunningStats = {
  dartsThrown: number;
  scoringVisitCount: number;
  threeDartAverage: number;
  scoringAverage: number;
  checkoutPercentage: number;
  doubleAttempts: number;
  checkouts: number;
};

export function createEmptySetRunningStats(): SetRunningStats {
  return {
    dartsThrown: 0,
    scoringVisitCount: 0,
    threeDartAverage: 0,
    scoringAverage: 0,
    checkoutPercentage: 0,
    doubleAttempts: 0,
    checkouts: 0,
  };
}
```

Extend `SimulateVisitContext`:

```ts
export type SimulateVisitContext = {
  remaining: number;
  skill: SkillProfile;
  legTarget: number;
  dartsInVisit: number;
  setRunningStats: SetRunningStats;
};
```

- [ ] **Step 4: Export new types from `index.ts`**

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/dartbot/types.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/shared/dartbot/types.ts app/src/lib/shared/dartbot/index.ts app/tests/lib/shared/dartbot/types.test.ts
git commit -m "refactor(dartbot): replace execution model with distribution types"
```

---

### Task 2: Anchor Level Profiles & Stat Ranges

**Files:**
- Create: `app/src/lib/shared/dartbot/level-profiles.ts`
- Test: `app/tests/lib/shared/dartbot/level-profiles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  ANCHOR_PROFILES,
  LEVEL_STAT_RANGES,
} from "@lib/shared/dartbot/level-profiles";

function sumWeights(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + b, 0);
}

describe("level-profiles", () => {
  it("has anchors at L1, L5, L10 only", () => {
    expect(ANCHOR_PROFILES.map((p) => p.level)).toEqual([1, 5, 10]);
  });

  it("L1 scoring outcomes sum to 100 and aim S20", () => {
    const l1 = ANCHOR_PROFILES.find((p) => p.level === 1)!;
    expect(l1.scoring.aim).toBe("S20");
    expect(sumWeights(l1.scoring.outcomes)).toBe(100);
    expect(l1.scoring.outcomes.S20).toBe(35);
  });

  it("LEVEL_STAT_RANGES covers levels 1-10 with explicit checkout bands", () => {
    expect(LEVEL_STAT_RANGES).toHaveLength(10);
    expect(LEVEL_STAT_RANGES[0]!.checkoutPercentage).toEqual({ min: 8, max: 30 });
    expect(LEVEL_STAT_RANGES[9]!.checkoutPercentage).toEqual({ min: 30, max: 50 });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement `level-profiles.ts`**

Authoritative tables from spec §3, §6–8. Structure:

```ts
import type { LevelProfile, StatRange } from "./types";

const L1_SCORING_OUTCOMES = { S20: 35, T20: 3, D20: 4, S5: 15, S1: 15, T5: 3, D5: 4, T1: 3, D1: 4, outside: 6, other: 8 };
// ... L5, L10 per spec §6

const L1_SETUP_SINGLES = { hit: 16, neighborSingle: 26, wrongRing: 24, neighborWrongRing: 22, outside: 8, other: 4 };
// ... all setup/double anchors per spec §7–8

const L1_CONVERGENCE = { maxScoringHitShift: 1.5, maxSetupHitShift: 2, maxCheckoutHitShift: 2, distanceScale: 0.15 };
const L5_CONVERGENCE = { maxScoringHitShift: 2.5, maxSetupHitShift: 3, maxCheckoutHitShift: 3, distanceScale: 0.2 };
const L10_CONVERGENCE = { maxScoringHitShift: 3.5, maxSetupHitShift: 4, maxCheckoutHitShift: 4, distanceScale: 0.25 };

function statRange(
  min: number,
  max: number,
  legBelow: number,
  legAbove: number,
  setBelow: number,
  setAbove: number,
): StatRange {
  return {
    min,
    max,
    deviation: {
      leg: { below: legBelow, above: legAbove },
      set: { below: setBelow, above: setAbove },
    },
  };
}

export const LEVEL_STAT_RANGES: Array<{
  level: number;
  threeDartAverage: StatRange;
  scoringAverage: StatRange;
  checkoutPercentage: { min: number; max: number };
}> = [
  { level: 1, threeDartAverage: statRange(30, 40, 5, 5, 3, 3), scoringAverage: statRange(37, 47, 6, 6, 4, 4), checkoutPercentage: { min: 8, max: 30 } },
  { level: 2, threeDartAverage: statRange(33, 43, 5, 5, 3, 3), scoringAverage: statRange(40, 50, 6, 6, 4, 4), checkoutPercentage: { min: 10, max: 30 } },
  // ... levels 3–10 from spec §3 tables (deviation anchors L1/L5/L10 + draft interpolated values)
];

export const ANCHOR_PROFILES: LevelProfile[] = [
  {
    level: 1,
    ...LEVEL_STAT_RANGES[0]!,
    scoring: { aim: "S20", outcomes: L1_SCORING_OUTCOMES },
    setup: { singles: L1_SETUP_SINGLES, trebles: L1_SETUP_TREBLES, outerBull: L1_OUTER_BULL, bull: L1_BULL },
    doubles: { outcomes: L1_DOUBLES },
    convergence: L1_CONVERGENCE,
  },
  // L5, L10 similarly
];
```

Copy every weight verbatim from spec §6–8. Do not interpolate stat ranges — use explicit §3 tables.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/shared/dartbot/level-profiles.ts app/tests/lib/shared/dartbot/level-profiles.test.ts
git commit -m "feat(dartbot): add anchor level profiles and stat ranges"
```

---

### Task 3: Level Interpolation

**Files:**
- Create: `app/src/lib/shared/dartbot/interpolate-levels.ts`
- Modify: `app/src/lib/shared/dartbot/levels.ts`
- Test: `app/tests/lib/shared/dartbot/interpolate-levels.test.ts`
- Modify: `app/tests/lib/shared/dartbot/levels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildLevelProfile } from "@lib/shared/dartbot/interpolate-levels";

function sumWeights(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + b, 0);
}

describe("buildLevelProfile", () => {
  it("returns exact anchors unchanged", () => {
    const l5 = buildLevelProfile(5);
    expect(l5.scoring.outcomes.T20).toBe(8);
    expect(sumWeights(l5.scoring.outcomes)).toBe(100);
  });

  it("L2 scoring matches draft table", () => {
    const l2 = buildLevelProfile(2);
    expect(l2.scoring.outcomes).toMatchObject({ S20: 39, T20: 4, outside: 6 });
    expect(l2.scoring.aim).toBe("S20");
  });

  it("L6 aims T20", () => {
    expect(buildLevelProfile(6).scoring.aim).toBe("T20");
  });

  it("rejects level 11", () => {
    expect(() => buildLevelProfile(11)).toThrow(/Invalid DartBot level/);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement interpolation**

`interpolate-levels.ts`:

```ts
import { ANCHOR_PROFILES, LEVEL_STAT_RANGES } from "./level-profiles";
import type { LevelProfile, SkillProfile } from "./types";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const scaled = entries.map(([k, w]) => [k, (w / total) * 100] as const);
  const floors = scaled.map(([k, w]) => [k, Math.floor(w)] as const);
  let remainder = 100 - floors.reduce((s, [, w]) => s + w, 0);
  const fractional = scaled
    .map(([k, w], i) => ({ k, frac: w - floors[i]![1] }))
    .sort((a, b) => b.frac - a.frac);
  const result = Object.fromEntries(floors);
  for (const { k } of fractional) {
    if (remainder <= 0) break;
    result[k] = (result[k] ?? 0) + 1;
    remainder -= 1;
  }
  return result;
}

function lerpOutcomeRecords(
  lower: Record<string, number>,
  upper: Record<string, number>,
  t: number,
): Record<string, number> {
  const keys = new Set([...Object.keys(lower), ...Object.keys(upper)]);
  const raw: Record<string, number> = {};
  for (const key of keys) {
    raw[key] = lerp(lower[key] ?? 0, upper[key] ?? 0, t);
  }
  return normalizeWeights(raw);
}

function lerpSetupOutcomes<T extends Record<string, number>>(
  lower: T,
  upper: T,
  t: number,
): T {
  return lerpOutcomeRecords(lower, upper, t) as T;
}

export function buildLevelProfile(level: number): SkillProfile {
  if (!Number.isInteger(level) || level < 1 || level > 10) {
    throw new Error(`Invalid DartBot level: ${level}`);
  }
  const anchor = ANCHOR_PROFILES.find((p) => p.level === level);
  if (anchor) {
    const { level: _l, ...rest } = anchor;
    return { level, ...rest };
  }

  const stats = LEVEL_STAT_RANGES[level - 1]!;
  const l1 = ANCHOR_PROFILES[0]!;
  const l5 = ANCHOR_PROFILES[1]!;
  const l10 = ANCHOR_PROFILES[2]!;

  let t: number;
  let lower: LevelProfile;
  let upper: LevelProfile;
  if (level <= 4) {
    t = (level - 1) / 4;
    lower = l1;
    upper = l5;
  } else {
    t = (level - 5) / 5;
    lower = l5;
    upper = l10;
  }

  return {
    level,
    threeDartAverage: stats.threeDartAverage,
    scoringAverage: stats.scoringAverage,
    checkoutPercentage: stats.checkoutPercentage,
    scoring: {
      aim: level <= 5 ? "S20" : "T20",
      outcomes: lerpOutcomeRecords(lower.scoring.outcomes, upper.scoring.outcomes, t),
    },
    setup: {
      singles: lerpSetupOutcomes(lower.setup.singles, upper.setup.singles, t),
      trebles: lerpSetupOutcomes(lower.setup.trebles, upper.setup.trebles, t),
      outerBull: lerpSetupOutcomes(lower.setup.outerBull, upper.setup.outerBull, t),
      bull: lerpSetupOutcomes(lower.setup.bull, upper.setup.bull, t),
    },
    doubles: {
      outcomes: lerpOutcomeRecords(
        lower.doubles.outcomes,
        upper.doubles.outcomes,
        t,
      ) as LevelProfile["doubles"]["outcomes"],
    },
    convergence: {
      maxScoringHitShift: lerp(lower.convergence.maxScoringHitShift, upper.convergence.maxScoringHitShift, t),
      maxSetupHitShift: lerp(lower.convergence.maxSetupHitShift, upper.convergence.maxSetupHitShift, t),
      maxCheckoutHitShift: lerp(lower.convergence.maxCheckoutHitShift, upper.convergence.maxCheckoutHitShift, t),
      distanceScale: lerp(lower.convergence.distanceScale, upper.convergence.distanceScale, t),
    },
  };
}
```

Replace `levels.ts` body:

```ts
import { buildLevelProfile } from "./interpolate-levels";
export { ANCHOR_PROFILES, LEVEL_STAT_RANGES } from "./level-profiles";

export function getSkillProfile(level: number): SkillProfile {
  return buildLevelProfile(level);
}
```

Update `levels.test.ts`: remove L15 cases; assert `getSkillProfile(10)` and `getSkillProfile(11)` throws.

- [ ] **Step 4: Run tests — expect PASS** (many downstream tests will fail until later tasks)

Run: `cd app && npm test -- tests/lib/shared/dartbot/interpolate-levels.test.ts tests/lib/shared/dartbot/levels.test.ts`

- [ ] **Step 5: Commit**

---

### Task 4: Stat Band Validation

**Files:**
- Create: `app/src/lib/shared/dartbot/stat-validation.ts`
- Test: `app/tests/lib/shared/dartbot/stat-validation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { isWithinStatBand } from "@lib/shared/dartbot/stat-validation";
import { getSkillProfile } from "@lib/shared/dartbot";

describe("isWithinStatBand", () => {
  const profile = getSkillProfile(1);

  it("passes at range midpoint for leg scope", () => {
    const mid = (profile.scoringAverage.min + profile.scoringAverage.max) / 2;
    expect(isWithinStatBand(mid, profile.scoringAverage, "leg")).toBe(true);
  });

  it("fails below leg band", () => {
    expect(
      isWithinStatBand(
        profile.scoringAverage.min - profile.scoringAverage.deviation.leg.below - 1,
        profile.scoringAverage,
        "leg",
      ),
    ).toBe(false);
  });

  it("set band is tighter than leg band", () => {
    const actual = profile.threeDartAverage.min - profile.threeDartAverage.deviation.set.below - 0.5;
    expect(isWithinStatBand(actual, profile.threeDartAverage, "set")).toBe(false);
    expect(isWithinStatBand(actual, profile.threeDartAverage, "leg")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

```ts
import type { StatRange } from "./types";

export function isWithinStatBand(
  actual: number,
  range: StatRange,
  scope: "leg" | "set",
): boolean {
  const d = range.deviation[scope];
  return actual >= range.min - d.below && actual <= range.max + d.above;
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

---

### Task 5: Outcome Sampling Utility

**Files:**
- Create: `app/src/lib/shared/dartbot/outcome-sample.ts`
- Test: `app/tests/lib/shared/dartbot/outcome-sample.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { applyHitShift, sampleWeightedBucket } from "@lib/shared/dartbot/outcome-sample";
import { createRng } from "@lib/shared/dartbot";

describe("outcome-sample", () => {
  it("sampleWeightedBucket respects weights", () => {
    const rng = createRng(1);
    const bucket = sampleWeightedBucket({ hit: 100, miss: 0 }, rng);
    expect(bucket).toBe("hit");
  });

  it("applyHitShift increases hit weight and renormalizes", () => {
    const shifted = applyHitShift({ hit: 20, miss: 80 }, "hit", 5);
    expect(shifted.hit).toBe(25);
    expect(shifted.hit + shifted.miss).toBe(100);
  });
});
```

- [ ] **Step 2–5: Implement, test, commit**

```ts
import type { Rng } from "./rng";

export function sampleWeightedBucket<T extends string>(
  weights: Record<T, number>,
  rng: Rng,
): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1]![0];
}

export function applyHitShift<T extends Record<string, number>>(
  weights: T,
  hitKey: keyof T & string,
  shiftPoints: number,
): T {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const maxShift = Math.min(shiftPoints, total - (weights[hitKey] as number));
  if (maxShift <= 0) return { ...weights };
  const others = Object.keys(weights).filter((k) => k !== hitKey);
  const otherTotal = others.reduce((s, k) => s + (weights[k] as number), 0);
  const next = { ...weights } as T;
  next[hitKey] = ((next[hitKey] as number) + maxShift) as T[keyof T];
  for (const key of others) {
    const share = ((weights[key] as number) / otherTotal) * maxShift;
    next[key as keyof T] = ((weights[key] as number) - share) as T[keyof T];
  }
  // round to integers summing to total
  const rounded = Object.fromEntries(
    Object.entries(next).map(([k, v]) => [k, Math.max(0, Math.round(v as number))]),
  ) as T;
  const sum = Object.values(rounded).reduce((a, b) => a + b, 0);
  rounded[hitKey] = ((rounded[hitKey] as number) + (total - sum)) as T[keyof T];
  return rounded;
}
```

---

### Task 6: Board Neighbors Export

**Files:**
- Modify: `app/src/lib/shared/dartbot/segments.ts`
- Test: `app/tests/lib/shared/dartbot/segments.test.ts` (add case)

- [ ] **Step 1: Add test**

```ts
it("boardNeighbors(12) returns 5 and 14", () => {
  expect(boardNeighbors(12)).toEqual([5, 14]);
});
```

- [ ] **Step 2–4: Export helper**

```ts
export function boardNeighbors(base: number): number[] {
  return neighbors(base);
}
```

---

### Task 7: Scoring Throw Engine

**Files:**
- Create: `app/src/lib/shared/dartbot/scoring-throw.ts`
- Test: `app/tests/lib/shared/dartbot/scoring-throw.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { throwScoringDart } from "@lib/shared/dartbot/scoring-throw";
import { getSkillProfile, createRng, scoreForSegment } from "@lib/shared/dartbot";

describe("throwScoringDart", () => {
  it("L1 can land on S20 bed segments", () => {
    const profile = getSkillProfile(1);
    const rng = createRng(42);
    const results = new Set<string>();
    for (let i = 0; i < 200; i++) {
      results.add(throwScoringDart(profile, { scoringHitShift: 0, setupHitShift: 0, checkoutHitShift: 0 }, rng).label);
    }
    expect(results.has("20")).toBe(true);
  });

  it("outside scores 0", () => {
    const profile = getSkillProfile(1);
    const seg = throwScoringDart(profile, { scoringHitShift: 0, setupHitShift: 0, checkoutHitShift: 0 }, { next: () => 0.99, getState: () => 0, setState: () => {} });
    expect(scoreForSegment(seg)).toBe(0);
  });
});
```

- [ ] **Step 3: Implement**

```ts
import { applyHitShift, sampleWeightedBucket } from "./outcome-sample";
import { parseSegment } from "./segments";
import type { ConvergenceBias, Segment, SkillProfile } from "./types";
import type { Rng } from "./rng";

const SCORING_OTHER_POOL = ["3", "7", "19", "T19", "S3", "S7"] as const;

function resolveScoringBucket(bucket: string, profile: SkillProfile, rng: Rng): Segment {
  if (bucket === "outside") return parseSegment("0"); // score 0 — use label that scores 0; if no "0" segment, return synthetic: check segments.ts — use a dedicated outside segment or { score: 0 } pattern
  if (bucket === "other") {
    const label = SCORING_OTHER_POOL[Math.floor(rng.next() * SCORING_OTHER_POOL.length)]!;
    return parseSegment(label);
  }
  return parseSegment(bucket.startsWith("S") ? bucket : bucket); // keys like S20 or use direct labels
}

export function throwScoringDart(
  profile: SkillProfile,
  bias: ConvergenceBias,
  rng: Rng,
): Segment {
  const aimKey = profile.scoring.aim;
  const weights = applyHitShift(profile.scoring.outcomes, aimKey, bias.scoringHitShift);
  const bucket = sampleWeightedBucket(weights, rng);
  return resolveScoringBucket(bucket, profile, rng);
}
```

**Note:** If `parseSegment("0")` is invalid, add `outsideSegment()` in `segments.ts` returning `{ label: "outside", score: 0, ring: "single", base: 0, adjacent: [] }` and use that for `outside` buckets across all throw engines.

- [ ] **Step 4–5: Test + commit**

---

### Task 8: Setup Throw Engine

**Files:**
- Create: `app/src/lib/shared/dartbot/setup-throw.ts`
- Test: `app/tests/lib/shared/dartbot/setup-throw.test.ts`

- [ ] **Step 1: Write failing tests per spec §12**

```ts
it("S12 neighbor singles are S5 and S14", () => {
  const target = parseSegment("12");
  const neighbors = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const actual = throwSetupDart(target, getSkillProfile(1), zeroBias, createRng(i));
    if (actual.ring === "single" && actual.base !== 12) neighbors.add(String(actual.base));
  }
  expect(neighbors.has("5")).toBe(true);
  expect(neighbors.has("14")).toBe(true);
});

it("L1 bull setup other exceeds outside frequency", () => {
  let other = 0;
  let outside = 0;
  for (let i = 0; i < 1000; i++) {
    const actual = throwSetupDart(parseSegment("25"), getSkillProfile(1), zeroBias, createRng(i));
    if (actual.label === "outside") outside += 1;
    else if (!["25", "50"].includes(actual.label)) other += 1;
  }
  expect(other).toBeGreaterThan(outside);
});
```

- [ ] **Step 3: Implement bucket resolution per spec §7** using `boardNeighbors`, `parseSegment`, `applyHitShift` on `hit` bucket.

---

### Task 9: Checkout Hit Rate

**Files:**
- Create: `app/src/lib/shared/dartbot/checkout-hit-rate.ts`
- Test: `app/tests/lib/shared/dartbot/checkout-hit-rate.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
it("returns rate within checkout percentage range", () => {
  const profile = getSkillProfile(1);
  const rng = createRng(7);
  for (let i = 0; i < 50; i++) {
    const rate = checkoutHitRateForDart(profile, 1, rng);
    expect(rate).toBeGreaterThanOrEqual(profile.checkoutPercentage.min / 100);
    expect(rate).toBeLessThanOrEqual(profile.checkoutPercentage.max / 100);
  }
});

it("three calls in one visit can differ", () => {
  const profile = getSkillProfile(1);
  const rng = createRng(99);
  const rates = [1, 2, 3].map((d) => checkoutHitRateForDart(profile, d as 1 | 2 | 3, rng));
  expect(new Set(rates).size).toBeGreaterThan(1);
});
```

- [ ] **Step 3: Implement**

```ts
import type { SkillProfile } from "./types";
import type { Rng } from "./rng";

export function checkoutHitRateForDart(
  profile: SkillProfile,
  dartIndexInVisit: 1 | 2 | 3,
  rng: Rng,
): number {
  const min = profile.checkoutPercentage.min / 100;
  const max = profile.checkoutPercentage.max / 100;
  const slice = (dartIndexInVisit - 1) / 3;
  const sliceWidth = (max - min) / 3;
  const sliceMin = min + slice * sliceWidth;
  const sliceMax = sliceMin + sliceWidth;
  return sliceMin + rng.next() * (sliceMax - sliceMin);
}
```

---

### Task 10: Double Throw Engine

**Files:**
- Create: `app/src/lib/shared/dartbot/double-throw.ts`
- Test: `app/tests/lib/shared/dartbot/double-throw.test.ts`

- [ ] **Implement** `throwDoubleDart(target, profile, dartIndex, bias, rng)`:
  1. `hitRate = checkoutHitRateForDart(...) + bias.checkoutHitShift / 100`, clamped to range
  2. Scale `profile.doubles.outcomes` so `hit = hitRate * 100`, renormalize miss buckets
  3. Sample + resolve per spec §8 (`inside` → single same number, `neighborSingle` → `boardNeighbors`, etc.)

---

### Task 11: Convergence Bias

**Files:**
- Create: `app/src/lib/shared/dartbot/convergence.ts`
- Test: `app/tests/lib/shared/dartbot/convergence.test.ts`

- [ ] **Tests per spec §12:**

```ts
it("returns zero bias when all set stats inside bands", () => {
  const profile = getSkillProfile(5);
  const stats = {
    dartsThrown: 100,
    scoringVisitCount: 30,
    threeDartAverage: 53,
    scoringAverage: 55,
    checkoutPercentage: 25,
    doubleAttempts: 20,
    checkouts: 5,
  };
  expect(computeConvergenceBias(stats, profile)).toEqual({
    scoringHitShift: 0,
    setupHitShift: 0,
    checkoutHitShift: 0,
  });
});

it("boosts scoring when 3DA below set band", () => {
  const profile = getSkillProfile(5);
  const stats = { ...base, threeDartAverage: profile.threeDartAverage.min - profile.threeDartAverage.deviation.set.below - 5 };
  expect(computeConvergenceBias(stats, profile).scoringHitShift).toBeGreaterThan(0);
  expect(computeConvergenceBias(stats, profile).scoringHitShift).toBeLessThanOrEqual(profile.convergence.maxScoringHitShift);
});
```

- [ ] **Implement** distance-based shift capped by `profile.convergence.max*HitShift`; map stat → throw type per spec §3.4.

---

### Task 12: Throw Engine Dispatch

**Files:**
- Modify: `app/src/lib/shared/dartbot/throw-engine.ts`
- Modify: `app/tests/lib/shared/dartbot/throw-engine.test.ts`

```ts
import type { ConvergenceBias, Segment, SkillProfile } from "./types";
import type { ThrowIntent } from "./strategy-engine";
import type { Rng } from "./rng";
import { throwScoringDart } from "./scoring-throw";
import { throwSetupDart } from "./setup-throw";
import { throwDoubleDart } from "./double-throw";

export function throwDart(
  target: Segment,
  profile: SkillProfile,
  intent: ThrowIntent,
  dartIndexInVisit: 1 | 2 | 3,
  bias: ConvergenceBias,
  rng: Rng,
): Segment {
  if (intent === "score") return throwScoringDart(profile, bias, rng);
  if (intent === "setup") return throwSetupDart(target, profile, bias, rng);
  return throwDoubleDart(target, profile, dartIndexInVisit, bias, rng);
}
```

Delete `miss-resolver.ts` import usage.

---

### Task 13: Checkout Target & Replanning

**Files:**
- Create: `app/src/lib/shared/dartbot/checkout-target.ts`
- Test: `app/tests/lib/shared/dartbot/checkout-target.test.ts`

```ts
import { getCheckoutHint } from "@lib/shared/darts";
import { parseSegment } from "./segments";
import type { Segment } from "./types";

export function nextCheckoutTarget(remaining: number): Segment | null {
  const hint = getCheckoutHint(remaining);
  if (!hint?.segments[0]) return null;
  return parseSegment(hint.segments[0]);
}
```

- [ ] **Replanning test (seeded visit simulation comes in Task 14):**

```ts
it("hint for 55 is S15", () => {
  expect(nextCheckoutTarget(55)?.label).toBe("15"); // after hints fix
});
```

---

### Task 14: Rewrite simulateVisit

**Files:**
- Modify: `app/src/lib/shared/dartbot/dart-bot.ts`
- Modify: `app/tests/lib/shared/dartbot/dart-bot.test.ts`

- [ ] **Key changes:**

```ts
export function simulateVisit(ctx: SimulateVisitContext, rng: Rng): SimulatedVisit {
  const bias = computeConvergenceBias(ctx.setRunningStats, ctx.skill);
  // loop darts:
  //   intent = chooseIntent(...)
  //   if intent === "score": throwScoringDart path (no target selection)
  //   else if checkout range: target = nextCheckoutTarget(remaining) ?? fallback setup route for 131-170
  //   if intent === "checkout": coerce double/bull target
  //   actual = throwDart(target, skill, intent, dartIndex, bias, rng)
  //   update remaining; replan each dart
}
```

- [ ] **Remove:** `chooseScoringTarget`, `CheckoutPlanner` for finishable ≤170 targets.
- [ ] **Keep:** `bestSetupRoute` + `checkoutKnowledge` for 131–170 when not finishable or intent is setup.
- [ ] **Update tests:** Replace `getSkillProfile(15)` with `getSkillProfile(10)`; add replanning test with `sequenceRng` for 74→60→55 path (assert third dart targets S15 after hint update — may need to force misses via mock throw engine or high miss seeds).

---

### Task 15: Set Running Stats

**Files:**
- Create: `app/src/lib/shared/dartbot/set-stats.ts`
- Test: `app/tests/lib/shared/dartbot/set-stats.test.ts`

```ts
import type { SetRunningStats } from "./types";

export type BotVisitForStats = {
  dartsThrown: number;
  visitScore: number;
  isScoringVisit: boolean;
  doubleAttempts: number;
  checkouts: number;
};

export function computeSetRunningStats(visits: BotVisitForStats[]): SetRunningStats {
  const dartsThrown = visits.reduce((s, v) => s + v.dartsThrown, 0);
  const scoringVisits = visits.filter((v) => v.isScoringVisit);
  const scoringPoints = scoringVisits.reduce((s, v) => s + v.visitScore, 0);
  const doubleAttempts = visits.reduce((s, v) => s + v.doubleAttempts, 0);
  const checkouts = visits.reduce((s, v) => s + v.checkouts, 0);
  const totalPoints = visits.reduce((s, v) => s + v.visitScore, 0);

  return {
    dartsThrown,
    scoringVisitCount: scoringVisits.length,
    threeDartAverage: dartsThrown > 0 ? (totalPoints / dartsThrown) * 3 : 0,
    scoringAverage:
      scoringVisits.length > 0 ? scoringPoints / scoringVisits.length : 0,
    checkoutPercentage: doubleAttempts > 0 ? (checkouts / doubleAttempts) * 100 : 0,
    doubleAttempts,
    checkouts,
  };
}
```

Add helper `visitStatsFromSimulatedVisit(visit, intent)` in same file or `dart-bot.ts`.

---

### Task 16: 501 Session Wiring

**Files:**
- Modify: `app/src/lib/shared/games/501/types.ts`
- Modify: `app/src/lib/shared/games/501/session-factory.ts`
- Modify: `app/src/lib/shared/games/501/bot-play.ts`
- Modify: `app/src/lib/shared/games/501/state.ts`
- Test: `app/tests/lib/shared/games/501/bot-play.test.ts`

- [ ] **Extend `FiveOhOneBotState`:**

```ts
import type { SetRunningStats } from "@lib/shared/dartbot";

export type FiveOhOneBotState = {
  matchPlan: MatchPlan;
  rngState: number;
  currentLegIndex: number;
  setRunningStats: SetRunningStats;
  setNumber: number;
};
```

- [ ] **session-factory:** init `setRunningStats: createEmptySetRunningStats()`, `setNumber: 1`
- [ ] **bot-play:** pass `setRunningStats` into `simulateVisit`; after visit, append bot visit stats and recompute
- [ ] **state.ts:** when `currentSet` increments, reset `botState.setRunningStats` and update `setNumber`

---

### Task 17: Match Planner Asymmetric Deviation

**Files:**
- Modify: `app/src/lib/shared/dartbot/match-planner.ts`
- Modify: `app/tests/lib/shared/dartbot/match-planner.test.ts`

Replace `skill.execution.variance` with:

```ts
function sampleLegTarget(skill: SkillProfile, rng: Rng): number {
  const midpoint = (skill.threeDartAverage.min + skill.threeDartAverage.max) / 2;
  const { below, above } = skill.threeDartAverage.deviation.leg;
  const offset =
    rng.next() < 0.5
      ? -rng.next() * below
      : rng.next() * above;
  return Math.max(0, Math.round(midpoint + offset));
}
```

---

### Task 18: Statistics Engine & Preview

**Files:**
- Modify: `app/src/lib/shared/dartbot/statistics-engine.ts`
- Modify: `app/src/lib/shared/dartbot/preview.ts`
- Modify: `app/tests/lib/shared/dartbot/statistics-engine.test.ts`
- Modify: `app/tests/lib/shared/dartbot/preview.test.ts`

- [ ] **preview:**

```ts
checkoutSuccessRate: `${profile.checkoutPercentage.min}–${profile.checkoutPercentage.max}%`,
```

Remove `checkoutAverage` single-point display or derive midpoint — check `501.settings.ts` UI bindings.

- [ ] **validateMatchStats:** use `isWithinStatBand` for 3DA/scoring at leg scope; checkout % against `checkoutPercentage` min–max (no deviation).

---

### Task 19: Checkout Hints Audit

**Files:**
- Modify: `app/src/lib/shared/darts/checkout-hints.data.ts`
- Modify: `app/tests/lib/shared/darts/checkouts.test.ts`

- [ ] **Required change:**

```ts
55: ["15", "D20"],
```

- [ ] **Audit rule:** For each finishable score where a wide single leaves a standard double (e.g. 61 → S1/D20 pattern), prefer single-to-double over triple leaving smaller double. Document changed entries in test comments.

```ts
it("returns S15 D20 for 55", () => {
  expect(getCheckoutHint(55)).toEqual({ segments: ["15", "D20"] });
});
```

---

### Task 20: Level Cap Consumers

**Files:**
- Modify: `app/src/lib/shared/games/501/validation.ts` (`p.level <= 10`)
- Modify: `app/src/components/games/501/DartBotLevelSlider.astro` (`max="10"`)
- Modify: `app/src/lib/shared/dartbot/strategy-engine.ts` (`skill.level >= 8` for checkout in 131–170 setup zone)
- Update tests: `validation.test.ts`, `preview.test.ts`, `scoring-averages.test.ts`, `checkout-planner.test.ts`, `dart-bot.test.ts` — remove L15 references

---

### Task 21: Remove Dead Code

**Files:**
- Delete: `app/src/lib/shared/dartbot/miss-resolver.ts`
- Delete: `app/src/lib/shared/dartbot/route-engine.ts`
- Delete: `app/tests/lib/shared/dartbot/throw-engine.test.ts` cases referencing hitAccuracy (rewrite)
- Grep for imports of deleted files; fix all

**Keep** `checkout/CheckoutPlanner.ts` — still used for 131–170 setup zone route picking.

---

### Task 22: Monte Carlo Validation

**Files:**
- Create: `app/tests/lib/shared/dartbot/monte-carlo.test.ts`

- [ ] **Implement simulation harness** (test-only, not production):

```ts
import { describe, expect, it } from "vitest";
import { createRng, getSkillProfile, simulateVisit, isWithinStatBand } from "@lib/shared/dartbot";
import { createEmptySetRunningStats } from "@lib/shared/dartbot/types";

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const VISITS_PER_LEG = 12;
const LEGS_PER_SET = 5;

describe("dartbot monte carlo", () => {
  for (const level of LEVELS) {
    it(`level ${level} set stats within bands`, () => {
      const profile = getSkillProfile(level);
      const rng = createRng(level * 1000);
      let setStats = createEmptySetRunningStats();
      // simulate LEGS_PER_SET legs, aggregate per-leg and per-set averages
      // assert isWithinStatBand for scoring + 3DA at leg and set scope
      // assert checkout % within checkoutPercentage min-max over full set
      expect(true).toBe(true); // replace with real assertions
    });
  }
}, 30_000);
```

Use generous but bounded iteration counts so CI stays <30s. If flaky, seed per level and document tolerance.

Run: `cd app && npm test -- tests/lib/shared/dartbot/monte-carlo.test.ts`

---

### Task 23: Barrel & AGENTS.md

**Files:**
- Modify: `app/src/lib/shared/dartbot/index.ts`
- Modify: `AGENTS.md`

Export: `getSkillProfile`, `simulateVisit`, `isWithinStatBand`, `formatDartbotLevelPreview`, `createEmptySetRunningStats`. Do **not** export `checkout/` internals or anchor tables unless tests need them via deep import exception.

AGENTS.md: update DartBot section — level cap 10, distribution-based throw model, file layout from spec §5.

- [ ] **Final verification gate** (see top)

- [ ] **Commit**

```bash
git commit -m "feat(dartbot): distribution-based levels 1-10 with convergence"
```

---

## Spec Coverage Checklist

| Spec § | Task(s) |
| ------ | ------- |
| §2 Stat definitions | Tasks 4, 11, 15, 18, 22 |
| §3 Level stat ranges + deviation | Tasks 2, 3, 17, 18 |
| §3.4 Soft convergence | Tasks 11, 14, 15, 16 |
| §4 Data model | Task 1 |
| §5 File layout | All tasks |
| §6–8 Anchor distributions | Task 2 |
| §9 Interpolation | Task 3 |
| §10 Checkout routing | Tasks 13, 14, 19 |
| §11 Throw engines | Tasks 5–12 |
| §12 Validation & testing | Tasks 4, 7–11, 13–15, 19, 22 |
| §13 Consumers | Tasks 16, 18, 20, 23 |
| §14 Out of scope | No tasks (explicitly excluded) |
| §15 Success criteria | Task 22 + integration |

---

## Architect Review

**Verdict:** Plan matches spec with deliberate restraint on future-scale complexity. Suitable for single-user client-session app today; extension points are clear without premature infrastructure.

### What scales well (keep)

| Decision | Why |
| -------- | --- |
| Pure functions in `lib/shared/dartbot/` | Stateless simulation — parallelizes for future server-side bot or analytics without refactor |
| Data/engine split (`level-profiles` vs `*-throw.ts`) | Tune distributions without touching dispatch logic; future DB-backed profiles swap data layer only |
| `getCheckoutHint` as routing SOT | One hint table for player + bot — no drift when hints evolve |
| `SetRunningStats` on session `botState` | Correct scope for client-authoritative play; no DB until multi-user bot leagues needed |
| Explicit stat ranges (not interpolated) | Stable UI labels; avoids subtle level-to-level stat regression |

### Complexity accepted (necessary per spec)

| Feature | Mitigation |
| ------- | ---------- |
| Soft set convergence | Capped shifts, throw-type-specific, no routing changes — bounded behavior |
| Four throw engines + sampler | Replaces messier `hitAccuracy`/`missSpread`; each file <150 LOC |
| Monte Carlo test suite | CI guard for tuning regressions; keep in test file only, not runtime |

### Complexity avoided (good for now)

| Not building | Rationale |
| ------------ | --------- |
| DartBot DB persistence | Spec §14; session state sufficient |
| Leg-level convergence | Preserves realistic hot/cold legs |
| `games/index` aggregator | Unrelated |
| Exporting full `checkout/` planner API | Internal to dartbot module |
| Server-side bot simulation API | Client session pattern already established |

### Risks & recommendations

1. **Flaky Monte Carlo (Task 22):** Use fixed seeds per level; if bands fail intermittently, widen test visit count before loosening bands. Do not weaken `isWithinStatBand` in production code to satisfy tests.

2. **`outside` segment scoring:** Introduce one shared `OUTSIDE_SEGMENT` constant in `segments.ts` early (Task 6/7) — avoids ad-hoc zero-score hacks across four engines.

3. **Level 11–15 sessions in `sessionStorage`:** Existing saved games may have `level: 15`. Add clamp in `getSkillProfile` consumer or session hydration: `Math.min(10, level)` — one line in `session-factory.ts` or play init. Not in spec but prevents runtime errors for returning users.

4. **Checkout hints audit (Task 19):** Manual audit is appropriate; do not build an automated hint optimizer — YAGNI until second game mode needs it.

5. **Future multi-user:** If bot stats or leaderboards arrive, only `set-stats` aggregation and convergence state would move server-side; shared throw engines remain unchanged. No plan change needed now.

### Simplification opportunity (optional, post-merge)

If convergence proves hard to tune (Task 22 failures), ship phases 1–2 without Task 11/16 convergence wiring, then add convergence in a follow-up PR. Spec treats convergence as secondary; core feel comes from distribution tables. **Default execution order in this plan includes convergence** — split only if blocked.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-30-dartbot-levels-simulation.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
