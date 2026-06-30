# Module Barrels & Types — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-30
**Branch:** TBD
**Scope:** Incremental restructure of `lib/shared` module boundaries — hybrid `types.ts`, full public API barrels (`index.ts`), ESLint import guardrails. Pilot modules: `games/501`, `dartbot`, `api/types`. Patterns documented in repo-root `AGENTS.md` for future modules.

**Approach:** Barrels + lint boundaries (Approach 2 from brainstorming)

**Depends on:** Existing game/dartbot modules — no behavior changes, import-path refactor only.

---

## 1. Problem

| Issue | Example |
| ----- | ------- |
| Types scattered across logic files | `FiveOhOneSession` in `session.ts`, `FiveOhOneSummary` in `summary.ts`, `FiveOhOneSettings` in `settings.ts` |
| No `types.ts` convention | Only 4 `types.ts` files exist; no rule for when to use them |
| Deep import fan-out | `501.play.ts` imports from 6+ paths; `[game].astro` imports 4 paths per game |
| `api/types.ts` couples to internals | Imports `FiveOhOneSummary` from `@lib/shared/games/501/summary` |
| No barrels | Consumers reach into implementation files directly |
| Internal files use absolute paths | `state.ts` imports `@lib/shared/games/501/constants` instead of `./constants` |

---

## 2. Decisions log (brainstorming)

| Topic | Decision |
| ----- | -------- |
| Scope | Incremental — `games/501`, `dartbot`, `api/types` first; other games follow same pattern later |
| Type placement | **Hybrid** — stable domain types in `types.ts`; function-coupled result types stay with their logic |
| Barrel contents | **Full public API** — types + functions + constants via `index.ts` |
| Internal imports | **Direct sibling only** (`./`) — barrel is for external consumers; no self-barrel |
| Cross-module imports | Use target module's barrel (e.g. `@lib/shared/dartbot`) |
| Enforcement | ESLint `no-restricted-imports` blocking deep paths into pilot modules |
| Agent guidance | Patterns written to repo-root `AGENTS.md` |

---

## 3. Module layout (target)

Each `lib/shared` feature module follows:

```text
games/501/
  types.ts          # domain types (Session, Settings, Summary, State, Stats, …)
  index.ts          # public barrel — re-exports types + public functions/constants
  session.ts        # logic; imports ./types, ./settings
  validation.ts     # keeps ValidateSettingsResult, ValidateVisitScoreResult
  completion.ts     # keeps ValidateCompletedFiveOhOneResult
  …                 # private helpers (leg-estimate, match) — not in barrel

dartbot/
  types.ts          # domain types (existing + MatchStats, ThrowIntent, BotCheckoutRoute, Rng)
  index.ts          # public barrel
  checkout/         # internal — not exported from barrel
  …

api/
  types.ts          # ApiResponse union; imports game types from game barrels
```

---

## 4. Type placement rules

### 4.1 Goes in `types.ts`

Stable data shapes that describe the module's domain model:

- Session, GameState, PlayerState, VisitRecord
- Settings, Player config types
- Summary, Stats
- Shared enums/unions used across multiple files in the module

### 4.2 Stays co-located with logic

Types tightly coupled to a single function's return shape:

- `ValidateSettingsResult`, `ValidateVisitScoreResult` → `validation.ts`
- `ValidateCompletedFiveOhOneResult` → `completion.ts`
- `ThrowIntent` → `strategy-engine.ts` (re-exported via barrel)
- `MatchStats`, `StatsValidation` → `statistics-engine.ts` (re-exported via barrel)

### 4.3 Type guards

Stay in the file that defines the runtime check (e.g. `isFiveOhOneSession` in `session.ts`), re-exported via barrel.

### 4.4 After extraction

Logic files import domain types from `./types` instead of from each other for shared shapes. Example: `session.ts` imports `FiveOhOneSettings` from `./types` (re-exported or defined there).

---

## 5. Import rules

### 5.1 External consumers

Pages, components, `lib/client`, `lib/server`, and **other** `lib/shared` modules:

```ts
// ✅
import {
  buildFiveOhOneSession,
  type FiveOhOneSession,
} from "@lib/shared/games/501";

// ❌ — blocked by ESLint
import { buildFiveOhOneSession } from "@lib/shared/games/501/session-factory";
```

### 5.2 Internal files (within the module)

```ts
// ✅ relative sibling imports
import type { FiveOhOneSettings } from "./settings";
import { STARTING_SCORE } from "./constants";

// ❌ never import own barrel
import { ... } from "@lib/shared/games/501";

// ❌ normalize away from absolute self-paths
import { ... } from "@lib/shared/games/501/constants";
```

### 5.3 Cross-module

```ts
// ✅ barrel
import { simulateVisit, type SimulatedVisit } from "@lib/shared/dartbot";
```

---

## 6. Public barrel surfaces

### 6.1 `games/501/index.ts`

| Category | Exports |
| -------- | ------- |
| Types | All from `types.ts` |
| Result types | `ValidateSettingsResult`, `ValidateVisitScoreResult`, `ValidateCompletedFiveOhOneResult` |
| Session | `buildFiveOhOneSession`, `isFiveOhOneSession` |
| Gameplay | `applyVisit`, `revertLastVisit`, `revertLastOpponentPair`, `validateVisitScore` |
| Dartbot glue | `simulateDartBotVisitForSession`, `isMatchWinningCheckoutPossible`, `isDartBotSession`, `isDartBotTurn`, `canUndoDartBotPair`, `getOpponentPlayer`, `lastTwoVisitsAreUserThenDartBot` |
| Settings | `validateFiveOhOneSettings`, `parseFiveOhOneSettingsFormData` |
| Completion | `validateCompletedFiveOhOneSession`, `buildSummary`, `buildMatchFormatLabel` |
| Stats | `applyGameCompletionToStats`, `createEmpty501Stats`, `Player501Stats` |
| Constants | `STARTING_SCORE`, `DARTS_PER_VISIT`, `LEGS_PER_SET`, `MIN_VISIT_SCORE`, `MAX_VISIT_SCORE`, format bounds |

**Private (not exported):** `leg-estimate.ts`, `match.ts`, `visit.ts` (`classifyVisit`), `bot-helpers.ts` internals consumed only by siblings — unless a symbol is needed externally (then add to barrel explicitly).

### 6.2 `dartbot/index.ts`

| Category | Exports |
| -------- | ------- |
| Types | All from `types.ts` + `MatchStats`, `StatsValidation`, `ThrowIntent`, `BotCheckoutRoute`, `Rng` |
| Simulation | `simulateVisit` |
| Planning | `generateMatchPlan`, `getSkillProfile`, `ANCHOR_LEVELS` |
| RNG | `createRng`, `hashSeed` |
| Stats | `validateMatchStats` |
| Segments | `parseSegment`, `scoreForSegment` |

**Private:** entire `checkout/` subsystem (`CheckoutPlanner`, `CheckoutKnowledge`, `CheckoutPolicy`, `CheckoutEvaluator`, `GeneratedCheckoutKnowledge`).

### 6.3 `api/types.ts`

- Imports game summary/session types from game barrels, not deep paths.
- Remains the API response type entry point for client code.
- No `api/index.ts` in phase 1 (types-only module).

---

## 7. `games/501/types.ts` — extraction map

| Type | Source file |
| ---- | ----------- |
| `FiveOhOneGameStatus`, `FiveOhOnePhase` | `session.ts` |
| `FiveOhOnePlayerState`, `FiveOhOneGameState`, `FiveOhOneBotState`, `FiveOhOneVisitRecord`, `FiveOhOneSession` | `session.ts` |
| `FiveOhOneUserOrGuestPlayer`, `FiveOhOneDartbotPlayer`, `FiveOhOnePlayer`, `FiveOhOneMatchMode`, `FiveOhOneUnit`, `FiveOhOneSettings` | `settings.ts` |
| `FiveOhOneSummary` | `summary.ts` |
| `Player501Stats` | `stats.ts` |
| `VisitClassification` | `visit.ts` |

Source files re-export from `./types` where needed for backward compatibility during migration, or import directly — barrel is the external contract.

---

## 8. ESLint boundary rules

Project has no ESLint today. Phase 1 adds minimal setup:

- `eslint`, `typescript-eslint` as devDependencies
- `eslint.config.js` (flat config)
- `no-restricted-imports` patterns:

```text
@lib/shared/games/501/*   → use @lib/shared/games/501
@lib/shared/dartbot/*     → use @lib/shared/dartbot
```

- Exception: files inside `games/501/**` may import `@lib/shared/games/501/*` is **not** needed — they use `./` only.
- Files inside `dartbot/**` use `./` only (no deep dartbot imports from outside checkout subtree via barrel).

Add `"lint": "eslint src tests"` script; run in verification alongside `check` and `test`.

---

## 9. Migration order

| Step | Work |
| ---- | ---- |
| 1 | Create `AGENTS.md` at repo root with module patterns (see §10) |
| 2 | Create `games/501/types.ts` — extract domain types |
| 3 | Update 501 sibling files to import from `./types` and use `./` relative paths |
| 4 | Create `games/501/index.ts` — curated public re-exports |
| 5 | Migrate external consumers (~12 files) to `@lib/shared/games/501` |
| 6 | Expand `dartbot/types.ts`; create `dartbot/index.ts` |
| 7 | Migrate dartbot external consumers (`501/bot-play.ts`, `501/session-factory.ts`, `501/session.ts`, `dartbot-turn-modal.ts`, `501.play.ts`) |
| 8 | Update `api/types.ts` to import from game barrels |
| 9 | Add ESLint + boundary rules |
| 10 | Update tests to use barrels where they import pilot modules |
| 11 | `npm run check && npm test && npm run lint` |

**Out of scope (phase 1):** `score-training`, `singles-training`, `ten-up-one-down`, `lib/server`, `lib/client` barrels. Same pattern documented in `AGENTS.md` for rollout.

---

## 10. `AGENTS.md` contents

Repo-root `AGENTS.md` documents:

1. Module layout (`types.ts` + `index.ts` + logic files)
2. Hybrid type placement rules (§4)
3. Import rules — external vs internal (§5)
4. How to add a new game module using the pattern
5. ESLint boundary expectation
6. Pilot modules list and rollout status

Agents and contributors must follow `AGENTS.md` when adding or modifying `lib/shared` modules.

---

## 11. External consumer migration list

### `games/501` barrel consumers

| File | Current deep imports |
| ---- | -------------------- |
| `src/lib/client/alpine/games/501.play.ts` | session-factory, session, bot-helpers, summary, bot-play, state, validation |
| `src/lib/client/alpine/games/501.settings.ts` | settings, constants |
| `src/pages/games/[game].astro` | form-data, session-factory, session, validation |
| `src/pages/api/games/501/complete.ts` | completion, summary, stats |
| `src/lib/server/data/player-501-stats.ts` | stats |
| `src/lib/shared/api/types.ts` | summary |
| `src/components/games/501/Play.astro` | session |
| Tests under `tests/lib/shared/games/501/` | various |

### `dartbot` barrel consumers

| File | Current deep imports |
| ---- | -------------------- |
| `src/lib/shared/games/501/bot-play.ts` | dart-bot, match-planner, rng, types |
| `src/lib/shared/games/501/session-factory.ts` | levels, match-planner, rng |
| `src/lib/shared/games/501/session.ts` | types |
| `src/lib/client/alpine/games/dartbot-turn-modal.ts` | types |
| `src/lib/client/alpine/games/501.play.ts` | statistics-engine |

---

## 12. Testing & verification

- **No new behavioral tests** — refactor only.
- Existing tests must pass unchanged in behavior; update import paths only.
- Verification gate: `npm run check && npm test && npm run lint`.
- Manual smoke: 501 play flow with DartBot opponent still works.

---

## 13. Risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Circular dependencies via barrel | Internal files never import barrel; types.ts has no logic imports |
| Barrel becomes a god-export | Curated list in §6; private helpers stay unexported |
| ESLint setup overhead | Minimal flat config; only boundary rules in phase 1 |
| Incomplete rollout confuses agents | `AGENTS.md` marks pilot vs pending modules |

---

## 14. Future rollout (post phase 1)

Apply same pattern to:

1. `games/score-training`
2. `games/singles-training`
3. `games/ten-up-one-down`
4. `games/index.ts` aggregator (optional — reduces `[game].astro` imports once all games have barrels)
5. `lib/shared/stats`, `lib/shared/darts` if cross-cutting import pain appears

Update `AGENTS.md` rollout status as each module completes.
