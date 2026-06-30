# Module Barrels & Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task subagent requirements (all mandatory):**
>
> 1. **verification-before-completion** — run the per-task verification gate before marking the task done; no completion claims without fresh command output
>
> A task is **not complete** until its verification gate passes with evidence recorded in the subagent's final report.

**Goal:** Restructure `games/501`, `dartbot`, and `api/types` with hybrid `types.ts`, public `index.ts` barrels, and ESLint import boundaries — no behavior changes.

**Architecture:** Domain types consolidate into per-module `types.ts`. Logic files use `./` sibling imports only. External consumers import from `@lib/shared/games/501` and `@lib/shared/dartbot`. ESLint blocks deep paths outside module internals and whitelisted private-module tests.

**Tech Stack:** TypeScript 6, Astro 6, Vitest, ESLint 9 (flat config), `@typescript-eslint`

**Spec:** `docs/superpowers/specs/2026-06-30-module-barrels-types-design.md`
**Agent guide:** `AGENTS.md` (already exists — update rollout status in final task)
**Working directory:** `app/` (all commands run from here unless noted)

---

## Verification Gate (every task)

**Iron law:** No completion claims without fresh verification evidence from this session.

This is a **refactor** — no new behavioral tests. Each task verifies existing tests still pass.

```bash
cd app && npm run check && npm test
```

Tasks 10–11 also require `npm run lint`. Final gate adds `npx fallow`.

---

## Final Verification Gate

Run only after Task 11.

```bash
cd app
npm run check
npm test
npm run lint
npx fallow
```

All four must exit 0.

---

## File Structure Overview

| File | Action | Responsibility |
| ---- | ------ | -------------- |
| `src/lib/shared/games/501/types.ts` | **Create** | All 501 domain types |
| `src/lib/shared/games/501/index.ts` | **Create** | Public barrel |
| `src/lib/shared/games/501/settings.ts` | **Delete** | Types moved to `types.ts` (file becomes empty) |
| `src/lib/shared/games/501/session.ts` | **Modify** | Type guard only; types from `./types` |
| `src/lib/shared/games/501/summary.ts` | **Modify** | Functions only; `FiveOhOneSummary` in `types.ts` |
| `src/lib/shared/games/501/stats.ts` | **Modify** | Functions only; `Player501Stats` in `types.ts` |
| `src/lib/shared/games/501/visit.ts` | **Modify** | `classifyVisit` only; type in `types.ts` |
| `src/lib/shared/games/501/*.ts` (remaining) | **Modify** | `./` imports, types from `./types` |
| `src/lib/shared/dartbot/index.ts` | **Create** | Public barrel |
| `src/lib/shared/dartbot/types.ts` | **Modify** | Add re-exports for `Rng`, `BotCheckoutRoute` |
| `src/lib/shared/dartbot/*.ts` | **Modify** | `./` sibling imports |
| `src/lib/shared/api/types.ts` | **Modify** | Import `FiveOhOneSummary` from 501 barrel |
| `eslint.config.js` | **Create** | `no-restricted-imports` boundaries |
| `package.json` | **Modify** | Add `lint` script + ESLint deps |
| `AGENTS.md` | **Modify** | Mark pilots complete |
| ~25 consumer/test files | **Modify** | Barrel imports |

### Boundary rules

| Who | Import from |
| --- | ----------- |
| External code (pages, client, server, other shared modules) | `@lib/shared/games/501`, `@lib/shared/dartbot` |
| Files inside `games/501/**` | `./` siblings only |
| Files inside `dartbot/**` | `./` siblings only (checkout uses `./` and `../`) |
| Tests of **private** modules | Deep path allowed (ESLint override) |

### ESLint exceptions (private-module tests)

These files intentionally test non-barrel exports:

- `tests/lib/shared/games/501/leg-estimate.test.ts`
- `tests/lib/shared/games/501/match.test.ts`
- `tests/lib/shared/games/501/visit.test.ts`
- `tests/lib/shared/dartbot/checkout-planner.test.ts`
- `tests/lib/shared/dartbot/checkout-knowledge.test.ts`

---

### Task 1: Create `games/501/types.ts` and relocate domain types

**Files:**

- Create: `app/src/lib/shared/games/501/types.ts`
- Modify: `app/src/lib/shared/games/501/session.ts`
- Modify: `app/src/lib/shared/games/501/summary.ts`
- Modify: `app/src/lib/shared/games/501/stats.ts`
- Modify: `app/src/lib/shared/games/501/visit.ts`
- Delete: `app/src/lib/shared/games/501/settings.ts`
- Modify: `app/src/lib/shared/games/501/validation.ts` (import settings types from `./types`)

- [ ] **Step 1: Create `types.ts`**

```ts
// app/src/lib/shared/games/501/types.ts
import type { MatchPlan } from "@lib/shared/dartbot/types";

export type FiveOhOneUserOrGuestPlayer = {
  id: string;
  type: "user" | "guest";
  name: string;
};

export type FiveOhOneDartbotPlayer = {
  id: string;
  type: "dartbot";
  name: "DartBot";
  level: number;
};

export type FiveOhOnePlayer =
  | FiveOhOneUserOrGuestPlayer
  | FiveOhOneDartbotPlayer;

export type FiveOhOneMatchMode = "best-of" | "first-to";
export type FiveOhOneUnit = "legs" | "sets";

export type FiveOhOneSettings = {
  matchMode: FiveOhOneMatchMode;
  targetCount: number;
  unit: FiveOhOneUnit;
  players: FiveOhOnePlayer[];
};

export type FiveOhOneGameStatus = "active" | "completed";
export type FiveOhOnePhase = "starter" | "play" | "summary";

export type FiveOhOnePlayerState = {
  playerId: string;
  remaining: number;
  dartsThisLeg: number;
  lastVisitScore: number | null;
  legsWonInSet: number;
  setsWon: number;
  totalLegsWon: number;
};

export type FiveOhOneGameState = {
  status: FiveOhOneGameStatus;
  phase: FiveOhOnePhase;
  currentPlayerId: string;
  currentLeg: number;
  currentSet: number;
  players: FiveOhOnePlayerState[];
  scoreAtVisitStart: number;
  legStartingPlayerId: string;
};

export type FiveOhOneBotState = {
  matchPlan: MatchPlan;
  rngState: number;
  currentLegIndex: number;
};

export type FiveOhOneVisitRecord = {
  visitNumber: number;
  playerId: string;
  visitScore: number;
  remainingBefore: number;
  remainingAfter: number;
  bust: boolean;
  checkout: boolean;
  legNumber: number;
  setNumber: number;
  stateSnapshot: FiveOhOneGameState;
  botRngBefore?: number;
};

export type FiveOhOneSession = {
  slug: "501";
  settings: FiveOhOneSettings;
  state: FiveOhOneGameState;
  visitHistory: FiveOhOneVisitRecord[];
  createdAt: string;
  updatedAt: string;
  botState?: FiveOhOneBotState;
};

export type FiveOhOneSummary = {
  resultLabel: string;
  matchFormatLabel: string;
  legsPlayed: number;
  userThreeDartAverage: number;
  userDartsThrown: number;
  checkouts: number;
  guestThreeDartAverage?: number;
  guestDartsThrown?: number;
  guestCheckouts?: number;
};

export type Player501Stats = {
  gamesCompleted: number;
  gamesWon: number;
  totalDartsThrown: number;
  totalCheckouts: number;
  bestLegAverage: number;
  bestMatchAverage: number;
};

export type VisitClassification = {
  bust: boolean;
  checkout: boolean;
  remainingAfter: number;
};
```

- [ ] **Step 2: Rewrite `session.ts` — type guard only**

```ts
// app/src/lib/shared/games/501/session.ts
import type { FiveOhOneSession } from "./types";

export type {
  FiveOhOneBotState,
  FiveOhOneGameState,
  FiveOhOneGameStatus,
  FiveOhOnePhase,
  FiveOhOnePlayerState,
  FiveOhOneSession,
  FiveOhOneVisitRecord,
} from "./types";

export function isFiveOhOneSession(value: unknown): value is FiveOhOneSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.slug === "501" &&
    Array.isArray(record.visitHistory) &&
    record.settings !== null &&
    typeof record.settings === "object" &&
    record.state !== null &&
    typeof record.state === "object"
  );
}
```

- [ ] **Step 3: Update `summary.ts` — remove `FiveOhOneSummary` definition, import from `./types`**

Remove the `export type FiveOhOneSummary = { ... }` block. Add:

```ts
import type {
  FiveOhOneSession,
  FiveOhOneSettings,
  FiveOhOneSummary,
  FiveOhOneVisitRecord,
} from "./types";

export type { FiveOhOneSummary } from "./types";
```

Keep `buildMatchFormatLabel` and `buildSummary` unchanged except imports.

- [ ] **Step 4: Update `stats.ts` — remove `Player501Stats` definition**

```ts
import type { FiveOhOneSession, Player501Stats } from "./types";

export type { Player501Stats } from "./types";
```

- [ ] **Step 5: Update `visit.ts` — remove `VisitClassification` definition**

```ts
import type { VisitClassification } from "./types";

export type { VisitClassification } from "./types";
```

- [ ] **Step 6: Update `validation.ts` — import settings types from `./types`**

Replace `@lib/shared/games/501/settings` import with:

```ts
import type { FiveOhOneDartbotPlayer, FiveOhOnePlayer, FiveOhOneSettings } from "./types";
```

- [ ] **Step 7: Delete `settings.ts`**

- [ ] **Step 8: Fix any broken imports in other 501 files**

Any file importing from `./settings` or `@lib/shared/games/501/settings` → `./types`.

Run: `cd app && npm run check`
Expected: 0 errors (may have warnings about unused re-exports — acceptable)

- [ ] **Step 9: Run verification gate**

Run: `cd app && npm run check && npm test`
Expected: PASS (fix any import errors surfaced by tests)

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/shared/games/501/types.ts app/src/lib/shared/games/501/session.ts app/src/lib/shared/games/501/summary.ts app/src/lib/shared/games/501/stats.ts app/src/lib/shared/games/501/visit.ts app/src/lib/shared/games/501/validation.ts
git add -u app/src/lib/shared/games/501/settings.ts
git commit -m "refactor(501): extract domain types into types.ts"
```

---

### Task 2: Normalize `games/501` internal imports to `./`

**Files:**

- Modify: all `app/src/lib/shared/games/501/*.ts` except `types.ts` and `index.ts` (not yet created)

Replace every `@lib/shared/games/501/<file>` import with `./<file>`.

Example — `state.ts` before/after:

```ts
// before
import { DARTS_PER_VISIT, STARTING_SCORE } from "@lib/shared/games/501/constants";
import { hasPlayerWonMatch, hasPlayerWonSet } from "@lib/shared/games/501/match";
import { lastTwoVisitsAreUserThenDartBot } from "@lib/shared/games/501/bot-helpers";
import type { FiveOhOneGameState, FiveOhOneSession, FiveOhOneVisitRecord } from "@lib/shared/games/501/session";
import { classifyVisit } from "@lib/shared/games/501/visit";

// after
import { DARTS_PER_VISIT, STARTING_SCORE } from "./constants";
import { hasPlayerWonMatch, hasPlayerWonSet } from "./match";
import { lastTwoVisitsAreUserThenDartBot } from "./bot-helpers";
import type { FiveOhOneGameState, FiveOhOneSession, FiveOhOneVisitRecord } from "./types";
import { classifyVisit } from "./visit";
```

Files to update (grep confirms all have absolute self-paths):

- `bot-helpers.ts`, `bot-play.ts`, `completion.ts`, `leg-estimate.ts`, `match.ts`, `session-factory.ts`, `session.ts`, `state.ts`, `summary.ts`, `stats.ts`, `validation.ts`

`session.ts` dartbot import stays `@lib/shared/dartbot/types` until Task 6.

- [ ] **Step 1: Replace imports in all 11 files**

- [ ] **Step 2: Run verification gate**

Run: `cd app && npm run check && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/shared/games/501/
git commit -m "refactor(501): use relative sibling imports internally"
```

---

### Task 3: Create `games/501/index.ts` barrel

**Files:**

- Create: `app/src/lib/shared/games/501/index.ts`

- [ ] **Step 1: Create barrel**

```ts
// app/src/lib/shared/games/501/index.ts

// Domain types
export type {
  FiveOhOneBotState,
  FiveOhOneDartbotPlayer,
  FiveOhOneGameState,
  FiveOhOneGameStatus,
  FiveOhOneMatchMode,
  FiveOhOnePhase,
  FiveOhOnePlayer,
  FiveOhOnePlayerState,
  FiveOhOneSession,
  FiveOhOneSettings,
  FiveOhOneSummary,
  FiveOhOneUnit,
  FiveOhOneUserOrGuestPlayer,
  FiveOhOneVisitRecord,
  Player501Stats,
  VisitClassification,
} from "./types";

// Result types (co-located with logic)
export type { ValidateCompletedFiveOhOneResult } from "./completion";
export type { ValidateSettingsResult, ValidateVisitScoreResult } from "./validation";

// Constants
export {
  DARTS_PER_VISIT,
  LEGS_PER_SET,
  MAX_TARGET_COUNT_LEGS,
  MAX_TARGET_COUNT_SETS,
  MAX_VISIT_SCORE,
  MIN_TARGET_COUNT_LEGS,
  MIN_TARGET_COUNT_SETS,
  MIN_VISIT_SCORE,
  STARTING_SCORE,
} from "./constants";

// Session
export { buildFiveOhOneSession } from "./session-factory";
export { isFiveOhOneSession } from "./session";

// Settings & form
export { parseFiveOhOneSettingsFormData } from "./form-data";
export { validateFiveOhOneSettings, validateVisitScore } from "./validation";

// Gameplay
export { applyVisit, revertLastOpponentPair, revertLastVisit } from "./state";

// DartBot glue
export {
  canUndoDartBotPair,
  getOpponentPlayer,
  isDartBotSession,
  isDartBotTurn,
  lastTwoVisitsAreUserThenDartBot,
} from "./bot-helpers";
export {
  isMatchWinningCheckoutPossible,
  simulateDartBotVisitForSession,
} from "./bot-play";

// Completion & summary
export { validateCompletedFiveOhOneSession } from "./completion";
export { buildMatchFormatLabel, buildSummary } from "./summary";

// Stats
export { applyGameCompletionToStats, createEmpty501Stats } from "./stats";
```

- [ ] **Step 2: Run verification gate**

Run: `cd app && npm run check && npm test`
Expected: PASS (barrel not yet consumed — no breakage)

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/shared/games/501/index.ts
git commit -m "refactor(501): add public API barrel"
```

---

### Task 4: Migrate external `games/501` consumers (src)

**Files:**

- Modify: `app/src/lib/client/alpine/games/501.play.ts`
- Modify: `app/src/lib/client/alpine/games/501.settings.ts`
- Modify: `app/src/pages/games/[game].astro`
- Modify: `app/src/pages/api/games/501/complete.ts`
- Modify: `app/src/lib/server/data/player-501-stats.ts`
- Modify: `app/src/lib/shared/api/types.ts` (501 line only — full api update in Task 9)
- Modify: `app/src/components/games/501/Play.astro`
- Modify: `app/scripts/fixtures/build-completed-501-session.ts`

- [ ] **Step 1: Rewrite `501.play.ts` imports**

```ts
import type { ApiResponse, FiveOhOneCompleteSuccess } from "@lib/shared/api/types";
import { getCheckoutHint } from "@lib/shared/darts/checkouts";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  applyVisit,
  buildFiveOhOneSession,
  buildMatchFormatLabel,
  buildSummary,
  canUndoDartBotPair,
  isDartBotSession,
  isDartBotTurn,
  isMatchWinningCheckoutPossible,
  revertLastOpponentPair,
  revertLastVisit,
  simulateDartBotVisitForSession,
  validateVisitScore,
  type FiveOhOneSession,
  type FiveOhOneSummary,
} from "@lib/shared/games/501";
import { validateMatchStats } from "@lib/shared/dartbot/statistics-engine";
import { animateDartBotVisit } from "@lib/client/alpine/games/dartbot-turn-modal";
```

Remove all `@lib/shared/games/501/<deep>` imports. Keep non-501 imports unchanged.

- [ ] **Step 2: Rewrite `501.settings.ts` imports**

```ts
import type { FiveOhOnePlayer } from "@lib/shared/games/501";
import {
  DARTS_PER_VISIT,
  MAX_TARGET_COUNT_LEGS,
  MAX_TARGET_COUNT_SETS,
  MIN_TARGET_COUNT_LEGS,
  MIN_TARGET_COUNT_SETS,
  MIN_VISIT_SCORE,
  MAX_VISIT_SCORE,
} from "@lib/shared/games/501";
```

- [ ] **Step 3: Rewrite `[game].astro` 501 imports**

```ts
import {
  buildFiveOhOneSession,
  parseFiveOhOneSettingsFormData,
  validateFiveOhOneSettings,
  type FiveOhOneSession,
} from "@lib/shared/games/501";
```

- [ ] **Step 4: Rewrite `complete.ts` imports**

```ts
import {
  applyGameCompletionToStats,
  buildSummary,
  validateCompletedFiveOhOneSession,
} from "@lib/shared/games/501";
```

- [ ] **Step 5: Rewrite `player-501-stats.ts` imports**

```ts
import {
  applyGameCompletionToStats,
  createEmpty501Stats,
  type Player501Stats,
} from "@lib/shared/games/501";
```

- [ ] **Step 6: Rewrite `Play.astro` import**

```ts
import type { FiveOhOneSession } from "@lib/shared/games/501";
```

- [ ] **Step 7: Rewrite `build-completed-501-session.ts` imports**

```ts
import { applyVisit, buildFiveOhOneSession } from "@lib/shared/games/501";
```

- [ ] **Step 8: Run verification gate**

Run: `cd app && npm run check && npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/client/alpine/games/501.play.ts app/src/lib/client/alpine/games/501.settings.ts app/src/pages/games/[game].astro app/src/pages/api/games/501/complete.ts app/src/lib/server/data/player-501-stats.ts app/src/components/games/501/Play.astro app/scripts/fixtures/build-completed-501-session.ts
git commit -m "refactor(501): migrate src consumers to barrel"
```

---

### Task 5: Migrate `games/501` test consumers to barrel

**Files:**

- Modify: all `app/tests/**` files importing `@lib/shared/games/501/*` **except** the ESLint-exception private-module tests

**Migrate to barrel:**

- `tests/lib/client/alpine/games/501.play.test.ts`
- `tests/lib/shared/games/501/state.test.ts`
- `tests/lib/shared/games/501/bot-play.test.ts`
- `tests/lib/shared/games/501/completion.test.ts`
- `tests/lib/shared/games/501/summary.test.ts`
- `tests/lib/shared/games/501/bot-helpers.test.ts`
- `tests/lib/shared/games/501/session-factory.test.ts`
- `tests/lib/shared/games/501/validation.test.ts`
- `tests/lib/shared/games/501/stats.test.ts`
- `tests/lib/shared/games/501/form-data.test.ts`
- `tests/lib/shared/games/501/constants.test.ts`
- `tests/api/games/501/complete.test.ts`
- `tests/lib/server/data/player-501-stats.test.ts`

**Keep deep imports (private module tests — do not change):**

- `tests/lib/shared/games/501/leg-estimate.test.ts`
- `tests/lib/shared/games/501/match.test.ts`
- `tests/lib/shared/games/501/visit.test.ts`

- [ ] **Step 1: Example — `state.test.ts`**

```ts
import { LEGS_PER_SET, STARTING_SCORE, applyVisit, buildFiveOhOneSession, revertLastVisit } from "@lib/shared/games/501";
```

- [ ] **Step 2: Update remaining 12 test files** using the same pattern — one import from `@lib/shared/games/501`

- [ ] **Step 3: Run verification gate**

Run: `cd app && npm run check && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/tests/
git commit -m "refactor(501): migrate tests to barrel imports"
```

---

### Task 6: Normalize `dartbot` internal imports and create barrel

**Files:**

- Create: `app/src/lib/shared/dartbot/index.ts`
- Modify: all `app/src/lib/shared/dartbot/**/*.ts` (use `./` and `../` instead of `@lib/shared/dartbot/...`)

- [ ] **Step 1: Normalize dartbot root files**

Example — `dart-bot.ts`:

```ts
import { chooseScoringTarget } from "./route-engine";
import { scoreForSegment, parseSegment } from "./segments";
import { chooseIntent } from "./strategy-engine";
import { throwDart } from "./throw-engine";
import { createCheckoutKnowledge, type CheckoutKnowledge } from "./checkout/CheckoutKnowledge";
import { SkillCheckoutPolicy } from "./checkout/CheckoutPolicy";
import { CheckoutPlanner } from "./checkout/CheckoutPlanner";
import { evaluateSetupRoute } from "./checkout/CheckoutEvaluator";
import type { BotCheckoutRoute } from "./checkout/bot-checkout-route";
import type { Rng } from "./rng";
import type { Segment, SimulateVisitContext, SimulatedVisit } from "./types";
```

Apply same pattern to: `statistics-engine.ts`, `route-engine.ts`, `strategy-engine.ts`, `throw-engine.ts`, `miss-resolver.ts`, `match-planner.ts`, `levels.ts`, `segments.ts`, `rng.ts`.

- [ ] **Step 2: Normalize checkout subdirectory**

Example — `checkout/CheckoutPlanner.ts`:

```ts
import type { CheckoutKnowledge } from "./CheckoutKnowledge";
import type { CheckoutPolicy } from "./CheckoutPolicy";
import type { BotCheckoutRoute } from "./bot-checkout-route";
import type { SkillProfile } from "../types";
```

Apply to all files in `checkout/`.

- [ ] **Step 3: Add type re-exports to `types.ts`**

```ts
// append to app/src/lib/shared/dartbot/types.ts
export type { Rng } from "./rng";
export type { BotCheckoutRoute } from "./checkout/bot-checkout-route";
export type { ThrowIntent } from "./strategy-engine";
export type { MatchStats, StatsValidation } from "./statistics-engine";
```

- [ ] **Step 4: Create `dartbot/index.ts`**

```ts
// app/src/lib/shared/dartbot/index.ts

// Domain types
export type {
  BotCheckoutRoute,
  LevelProfile,
  MatchPlan,
  MatchStats,
  Rng,
  Segment,
  SegmentLabel,
  SimulatedDart,
  SimulatedVisit,
  SimulateVisitContext,
  SkillProfile,
  StatsValidation,
  ThrowIntent,
} from "./types";

// Simulation
export { simulateVisit } from "./dart-bot";

// Planning & levels
export { ANCHOR_LEVELS, getSkillProfile } from "./levels";
export { generateMatchPlan } from "./match-planner";

// RNG
export { createRng, hashSeed } from "./rng";

// Stats validation
export { validateMatchStats } from "./statistics-engine";

// Segments
export { parseSegment, scoreForSegment } from "./segments";
```

- [ ] **Step 5: Update `games/501/types.ts` dartbot import**

```ts
import type { MatchPlan } from "@lib/shared/dartbot";
```

- [ ] **Step 6: Run verification gate**

Run: `cd app && npm run check && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/shared/dartbot/ app/src/lib/shared/games/501/types.ts
git commit -m "refactor(dartbot): relative imports and public API barrel"
```

---

### Task 7: Migrate external `dartbot` consumers

**Files:**

- Modify: `app/src/lib/shared/games/501/bot-play.ts`
- Modify: `app/src/lib/shared/games/501/session-factory.ts`
- Modify: `app/src/lib/client/alpine/games/501.play.ts`
- Modify: `app/src/lib/client/alpine/games/dartbot-turn-modal.ts`
- Modify: `app/tests/lib/client/alpine/games/dartbot-turn-modal.test.ts`
- Modify: `app/tests/lib/shared/dartbot/dart-bot.test.ts`
- Modify: `app/tests/lib/shared/dartbot/statistics-engine.test.ts`
- Modify: `app/tests/lib/shared/dartbot/strategy-engine.test.ts`
- Modify: `app/tests/lib/shared/dartbot/throw-engine.test.ts`
- Modify: `app/tests/lib/shared/dartbot/match-planner.test.ts`
- Modify: `app/tests/lib/shared/dartbot/levels.test.ts`
- Modify: `app/tests/lib/shared/dartbot/rng.test.ts`
- Modify: `app/tests/lib/shared/dartbot/segments.test.ts`

**Keep deep imports (private checkout tests — do not change):**

- `tests/lib/shared/dartbot/checkout-planner.test.ts`
- `tests/lib/shared/dartbot/checkout-knowledge.test.ts`

- [ ] **Step 1: Rewrite `501/bot-play.ts`**

```ts
import {
  createRng,
  generateMatchPlan,
  simulateVisit,
  type SimulatedVisit,
} from "@lib/shared/dartbot";
```

- [ ] **Step 2: Rewrite `501/session-factory.ts`**

```ts
import { createRng, generateMatchPlan, getSkillProfile, hashSeed } from "@lib/shared/dartbot";
```

- [ ] **Step 3: Rewrite `501.play.ts` dartbot import**

```ts
import { validateMatchStats } from "@lib/shared/dartbot";
```

- [ ] **Step 4: Rewrite `dartbot-turn-modal.ts` and its test**

```ts
import type { SimulatedVisit } from "@lib/shared/dartbot";
```

- [ ] **Step 5: Rewrite dartbot unit tests** (except checkout private tests)

Example — `dart-bot.test.ts`:

```ts
import { createRng, getSkillProfile, simulateVisit, type Rng, type SimulatedDart } from "@lib/shared/dartbot";
```

- [ ] **Step 6: Run verification gate**

Run: `cd app && npm run check && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/shared/games/501/bot-play.ts app/src/lib/shared/games/501/session-factory.ts app/src/lib/client/alpine/games/ app/tests/lib/client/alpine/games/dartbot-turn-modal.test.ts app/tests/lib/shared/dartbot/dart-bot.test.ts app/tests/lib/shared/dartbot/statistics-engine.test.ts app/tests/lib/shared/dartbot/strategy-engine.test.ts app/tests/lib/shared/dartbot/throw-engine.test.ts app/tests/lib/shared/dartbot/match-planner.test.ts app/tests/lib/shared/dartbot/levels.test.ts app/tests/lib/shared/dartbot/rng.test.ts app/tests/lib/shared/dartbot/segments.test.ts
git commit -m "refactor(dartbot): migrate external consumers to barrel"
```

---

### Task 8: Update `api/types.ts`

**Files:**

- Modify: `app/src/lib/shared/api/types.ts`

- [ ] **Step 1: Change 501 import to barrel**

```ts
import type { MessageCode } from "@lib/shared/constants/errors.constants";
import type { GameConfig, GameType } from "@lib/shared/games/types";
import type { FiveOhOneSummary } from "@lib/shared/games/501";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";
import type { ScoreTrainingSummary } from "@lib/shared/games/score-training/summary";
import type { SinglesTrainingSummary } from "@lib/shared/games/singles-training/summary";
import type { TenUpOneDownSummary } from "@lib/shared/games/ten-up-one-down/summary";
```

Only the `FiveOhOneSummary` line changes. Other game deep imports stay until those modules get barrels (out of scope).

- [ ] **Step 2: Run verification gate**

Run: `cd app && npm run check && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/shared/api/types.ts
git commit -m "refactor(api): import FiveOhOneSummary from 501 barrel"
```

---

### Task 9: Add ESLint import boundaries

**Files:**

- Create: `app/eslint.config.js`
- Modify: `app/package.json`

- [ ] **Step 1: Install ESLint**

```bash
cd app && npm install -D eslint @eslint/js typescript-eslint
```

- [ ] **Step 2: Create `eslint.config.js`**

```js
// app/eslint.config.js
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const deepImportRestriction = {
  patterns: [
    {
      group: ["@lib/shared/games/501/*"],
      message: "Import from @lib/shared/games/501 barrel instead.",
    },
    {
      group: ["@lib/shared/dartbot/*"],
      message: "Import from @lib/shared/dartbot barrel instead.",
    },
  ],
};

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", ".astro/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.{ts,astro}", "tests/**/*.{ts,tsx}", "scripts/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", deepImportRestriction],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
  // Module internals use ./ imports — no restriction
    files: ["src/lib/shared/games/501/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["src/lib/shared/dartbot/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
  // Tests of private (non-barrel) exports
    files: [
      "tests/lib/shared/games/501/leg-estimate.test.ts",
      "tests/lib/shared/games/501/match.test.ts",
      "tests/lib/shared/games/501/visit.test.ts",
      "tests/lib/shared/dartbot/checkout-planner.test.ts",
      "tests/lib/shared/dartbot/checkout-knowledge.test.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
);
```

- [ ] **Step 3: Add lint script to `package.json`**

```json
"lint": "eslint src tests scripts"
```

- [ ] **Step 4: Run lint and fix any violations**

Run: `cd app && npm run lint`
Expected: 0 errors. If violations appear in files missed during migration, fix imports to use barrels.

- [ ] **Step 5: Run full verification gate**

Run: `cd app && npm run check && npm test && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/eslint.config.js app/package.json app/package-lock.json
git commit -m "chore: add ESLint import boundary rules for 501 and dartbot"
```

---

### Task 10: Update `AGENTS.md` rollout status

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Update pilot status line**

Change:

```markdown
**Pilot modules (barrels in place or in progress):** `games/501`, `dartbot`
```

To:

```markdown
**Pilot modules (barrels complete):** `games/501`, `dartbot`
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: mark 501 and dartbot barrel rollout complete"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run final verification gate**

```bash
cd app
npm run check
npm test
npm run lint
npx fallow
```

Expected: all four exit 0.

- [ ] **Step 2: Grep for stale deep imports in external code**

```bash
cd app
rg "@lib/shared/games/501/" src tests scripts --glob '!src/lib/shared/games/501/**' --glob '!tests/lib/shared/games/501/{leg-estimate,match,visit}.test.ts"
rg "@lib/shared/dartbot/" src tests --glob '!src/lib/shared/dartbot/**' --glob '!tests/lib/shared/dartbot/checkout*.test.ts'
```

Expected: no matches (except whitelisted private-module tests).

- [ ] **Step 3: Manual smoke (optional but recommended)**

1. `npm run dev`
2. Open `/games/settings-501`, add DartBot opponent, start game
3. Submit a visit, confirm bot turn modal fires
4. Confirm no console errors

---

### Task 12: Write rollout handoff for next agent

**Files:**

- Create: `docs/superpowers/context/module-barrels-types-handoff.md`

Living handoff document so a fresh agent can continue barrel/types cleanup across the rest of the codebase without re-reading the full brainstorming thread.

- [ ] **Step 1: Create handoff document**

```markdown
# Module Barrels & Types — Rollout Handoff

> Living document for handoff between agents. Update after each module rollout.

**Status:** Phase 1 complete (`games/501`, `dartbot`, `api/types` partial)
**Last updated:** YYYY-MM-DD
**Branch:** <current branch>
**Plan:** `docs/superpowers/plans/2026-06-30-module-barrels-types.md`
**Spec:** `docs/superpowers/specs/2026-06-30-module-barrels-types-design.md`
**Agent guide:** `AGENTS.md`

---

## What was done (phase 1)

- `games/501/types.ts` — domain types extracted
- `games/501/index.ts` — full public API barrel
- `dartbot/index.ts` — public barrel (checkout subsystem private)
- `api/types.ts` — `FiveOhOneSummary` from 501 barrel
- ESLint `no-restricted-imports` for `@lib/shared/games/501/*` and `@lib/shared/dartbot/*`
- `AGENTS.md` — module patterns documented

---

## Rollout queue (priority order)

| Priority | Module | Deep-import pain | Notes |
| -------- | ------ | ---------------- | ----- |
| 1 | `games/score-training` | `[game].astro`, `api/types.ts`, client play | Mirror 501 pattern exactly |
| 2 | `games/singles-training` | same | Mirror 501 |
| 3 | `games/ten-up-one-down` | same | Mirror 501 |
| 4 | `api/types.ts` | Remaining game summary imports | Switch to barrels as each game completes |
| 5 | `lib/shared/stats` | Low — only `types.ts` today | Barrel if cross-cutting imports grow |
| 6 | `lib/shared/darts` | Used by 501 visit + checkout | Barrel optional |
| 7 | `games/index.ts` aggregator | `[game].astro` 18-import fan-out | Only after all games have barrels |

---

## Per-module checklist (copy for each rollout)

1. Create `<module>/types.ts` — extract domain types per `AGENTS.md` hybrid rule
2. Update sibling files — import types from `./types`, use `./` relative paths
3. Create `<module>/index.ts` — curated public re-exports (see 501 barrel as template)
4. Migrate external consumers — grep `@lib/shared/<module>/` outside module folder
5. Migrate tests — barrel imports except private-module test exceptions
6. Add ESLint boundary — extend `eslint.config.js` with `@lib/shared/<module>/*` pattern
7. Update `AGENTS.md` pilot list
8. Update this handoff — mark module complete, note any deviations
9. Run: `cd app && npm run check && npm test && npm run lint && npx fallow`

---

## Known exceptions

- Tests of **private** (non-barrel) exports keep deep imports; add ESLint override per file
- `settings.ts` may be deleted when it only contained types (501 precedent)
- Cross-module: always import from target barrel, never deep paths

---

## Grep helpers (find remaining cleanup)

```bash
cd app
# All deep game imports outside their module
rg "@lib/shared/games/" src tests scripts --glob '!src/lib/shared/games/**'

# api/types deep imports (should shrink as games roll out)
rg "from \"@lib/shared/games/" src/lib/shared/api/types.ts

# Files with 5+ @lib imports (candidates for barrel migration)
rg -c "^import " src --glob '*.{ts,astro}' | sort -t: -k2 -rn | head -20
```

---

## Open questions / deviations

(Document any decisions made during phase 1 that differ from the spec, or blockers hit.)

---

## Suggested next prompt for a new agent

> Continue the module barrels rollout per `docs/superpowers/context/module-barrels-types-handoff.md`.
> Start with `games/score-training` using the 501 pattern in `AGENTS.md`.
> Follow `docs/superpowers/plans/` template: one module per session, verification gate after each.
```

Fill in `YYYY-MM-DD`, branch name, and any phase-1 deviations discovered during Tasks 1–11.

- [ ] **Step 2: Link handoff from `AGENTS.md`**

Add under **Related docs**:

```markdown
- Rollout handoff: `docs/superpowers/context/module-barrels-types-handoff.md`
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/context/module-barrels-types-handoff.md AGENTS.md
git commit -m "docs: add module barrels rollout handoff for phase 2"
```

---

## Spec Coverage Checklist

| Spec section | Task |
| ------------ | ---- |
| §3 Module layout | Tasks 1, 3, 6 |
| §4 Type placement rules | Task 1 |
| §5 Import rules | Tasks 2, 4, 6, 7 |
| §6 Barrel surfaces | Tasks 3, 6 |
| §7 501 extraction map | Task 1 |
| §8 ESLint boundaries | Task 9 |
| §9 Migration order | Tasks 1–12 |
| §10 AGENTS.md | Tasks 10, 12 |
| §11 Consumer migration list | Tasks 4, 5, 7, 8 |
| §12 Testing | Every task verification gate |
| §14 Future rollout | Task 12 handoff |
