# Shared Module Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task subagent requirements:** verification-before-completion — run the per-task verification gate before marking done; no completion claims without fresh command output.

**Goal:** Align all `lib/shared` game modules with `AGENTS.md` barrel/type conventions, eliminate deep-import fan-out, and close enforcement gaps — no behavior changes.

**Architecture:** One module per session following the completed `games/501` pilot. Each rollout: extract `types.ts`, switch internals to `./` siblings, add curated `index.ts`, migrate external consumers to barrels, extend ESLint boundaries. Optional later phases: `api/types` consolidation, `darts`/`stats` barrels, `games/index.ts` aggregator for `[game].astro`.

**Tech Stack:** TypeScript 6, Astro 6, Vitest, ESLint 9 (flat config)

**References:**
- `AGENTS.md` — module structure, import rules, verification gate
- `docs/superpowers/context/module-barrels-types-handoff.md` — rollout queue + checklist
- `docs/superpowers/specs/2026-06-30-module-barrels-types-design.md` — design decisions
- `docs/superpowers/plans/2026-06-30-module-barrels-types.md` — phase 1 (complete)

**Working directory:** `app/`

---

## Inconsistency Audit (2026-06-30)

### A. Module barrels & types (high — in rollout queue)

| Module | `types.ts` | `index.ts` | ESLint boundary | External deep imports |
| ------ | ---------- | ---------- | --------------- | --------------------- |
| `games/501` | ✅ | ✅ | ✅ | ✅ barrel only |
| `dartbot` | ✅ | ✅ | ✅ | ✅ barrel only |
| `games/score-training` | ❌ types in `session.ts`, `settings.ts` | ❌ | ❌ | ~25 sites |
| `games/singles-training` | ❌ types in `session.ts`, `settings.ts`, `dart.ts` | ❌ | ❌ | ~30 sites |
| `games/ten-up-one-down` | ❌ types in `session.ts`, `settings.ts`, `round.ts` | ❌ | ❌ | ~35 sites |
| `api/types.ts` | N/A | N/A | N/A | Mixed: 501 barrel, 3 games deep |
| `lib/shared/stats` | ✅ | ❌ | ❌ | 8 sites (low pain) |
| `lib/shared/darts` | ❌ | ❌ | ❌ | 15+ sites |

### B. Internal import rule violations (medium)

`AGENTS.md`: *"Internal files — relative siblings only (`./`). Never import own barrel."*

| Module | Violation |
| ------ | --------- |
| `score-training/**` | 20+ self-references via `@lib/shared/games/score-training/...` |
| `singles-training/**` | 25+ self-references |
| `ten-up-one-down/**` | 25+ self-references |
| `darts/**` | 5 files use `@lib/shared/darts/...` instead of `./` |
| `stats/double-stats.ts` | imports `@lib/shared/stats/types` instead of `./types` |
| `games/501/**` | ✅ relative only |
| `dartbot/**` | ✅ relative only |

### C. `settings.ts` vs `types.ts` (medium)

501 precedent: `settings.ts` deleted after types moved to `types.ts`. Still present (types-only) in:

- `games/score-training/settings.ts` (4 lines)
- `games/singles-training/settings.ts` (9 lines)
- `games/ten-up-one-down/settings.ts` (4 lines)

### D. Import fan-out hotspots (medium — fixed by barrels)

| File | Issue |
| ---- | ----- |
| `src/pages/games/[game].astro` | 501 via barrel (4 imports); other 3 games × 4 deep imports each = 12 |
| `src/lib/client/alpine/games/*.play.ts` | 501 barrel; others 5–7 deep imports each |
| `src/pages/api/games/*/complete.ts` | 501 barrel; others 3 deep imports each |
| `src/lib/shared/api/types.ts` | 3 deep game summary/session imports remain |

### E. Enforcement gaps (medium)

- ESLint `no-restricted-imports` only covers `games/501/*` and `dartbot/*`
- `**/*.astro` excluded from ESLint — deep imports in Astro not blocked (documented in handoff)
- Non-pilot game tests use deep imports freely (expected until barrels exist; migrate with each module)

### F. Correct patterns already in place (no action)

- Layer boundaries: no `@db/` from client or shared ✅
- No legacy `username` keys ✅
- `session.userId` identity ✅
- Client-session games: `$persist` + completion API + play count on complete ✅
- Session JSON XSS escape in all 4 Play.astro shells ✅
- Cross-module dartbot imports use barrel ✅
- Data flow: pages → `lib/server/data/*` ✅

### G. Low-priority / deferred

| Item | Notes |
| ---- | ----- |
| `[game].astro` `incrementPlayCount` for non-client-session slugs | Legacy path for unreleased games (e.g. `121`); remove when 121 ships or all games are client-session |
| `games/121` | Components only, no `lib/shared` module — OK while `released: false` |
| `501/session.ts` re-exports types from `./types` | Redundant with barrel; optional cleanup after rollouts |
| `dartbot/index.ts` exports `ThrowIntent` | Design marks internal; low risk — trim in dartbot cleanup pass if desired |
| `games/index.ts` aggregator | Handoff priority 7 — only after all game barrels exist |

---

## Verification Gate (every task)

Refactor only — existing tests must pass.

```bash
cd app && npm run check && npm test && npm run lint && npx fallow
```

Per-game curl smoke after touching that game's play/completion:

```bash
./scripts/curl-verify-501.sh      # 501
./scripts/curl-verify-tuod.sh     # ten-up-one-down
# Add score-training / singles-training curl scripts when created
```

---

## Phase 2 — Game module rollouts (priority order)

> Copy the per-module checklist from handoff for each task. Mirror `games/501/index.ts` export curation — do **not** export private helpers (`leg-estimate`, `match`, `visit` equivalents).

### Task 1: `games/score-training` barrel

**Files:**
- Create: `src/lib/shared/games/score-training/types.ts`
- Create: `src/lib/shared/games/score-training/index.ts`
- Delete: `src/lib/shared/games/score-training/settings.ts`
- Modify: all sibling `.ts` files — `./` imports, types from `./types`
- Modify: external consumers (grep `@lib/shared/games/score-training/` outside module)
- Modify: `eslint.config.js` — add `@lib/shared/games/score-training/*` restriction + internal override
- Modify: `AGENTS.md` pilot list, `module-barrels-types-handoff.md`

**Types to extract to `types.ts`:**
- From `settings.ts`: `ScoreTrainingSettings`
- From `session.ts`: `ScoreTrainingGameStatus`, `ScoreTrainingGameState`, `ScoreTrainingSession`
- From `round.ts`: `ScoreTrainingRoundRecord` (if exported)
- From `summary.ts`: `ScoreTrainingSummary`

**Barrel exports (curated):**
- Types above + `ValidateSettingsResult` from `validation.ts`, `ValidateCompletedScoreTrainingResult` from `completion.ts`
- `buildScoreTrainingSession`, `isScoreTrainingSession`
- `parseScoreTrainingSettingsFormData`, `validateScoreTrainingSettings`
- `applyRoundToState`, `buildRoundRecord`, `validateRoundRecord`
- `validateCompletedScoreTrainingSession`, `buildSummary`, `applyGameCompletionToStats`, `createEmptyScoreTrainingStats`
- Constants: `STARTING_SCORE`, `DARTS_PER_VISIT`, etc.

**External migration targets:**
- `src/pages/games/[game].astro` (4 imports → 1)
- `src/lib/client/alpine/games/score-training.play.ts`
- `src/pages/api/games/score-training/complete.ts`
- `src/components/games/score-training/Play.astro`
- `src/lib/shared/api/types.ts` — `ScoreTrainingSession`, `ScoreTrainingSummary` from barrel
- Tests: switch to barrel except private-symbol test overrides

- [ ] Extract types, delete `settings.ts`, fix internal `./` imports
- [ ] Create barrel `index.ts`
- [ ] Migrate external consumers + tests
- [ ] ESLint boundary + overrides
- [ ] Update `AGENTS.md` + handoff
- [ ] Verification gate

### Task 2: `games/singles-training` barrel

Same checklist as Task 1.

**Types to extract:**
- From `settings.ts`: `SinglesTrainingDirection`, `SinglesTrainingMode`, `SinglesTrainingScoring`, `SinglesTrainingSettings`
- From `session.ts`: `SinglesTrainingTarget`, `SegmentCounts`, `SinglesTrainingSession`, game state types
- From `dart.ts`: `DartRecord`
- From `summary.ts`: `SinglesTrainingSummary`

**External migration targets:**
- `[game].astro`, `singles-training.play.ts`, `complete.ts`, `Play.astro`, `api/types.ts`, tests

- [ ] Same steps as Task 1
- [ ] Verification gate

### Task 3: `games/ten-up-one-down` barrel

Same checklist as Task 1.

**Types to extract:**
- From `settings.ts`: `TenUpOneDownSettings`
- From `session.ts`: `TenUpOneDownGameState`, `TenUpOneDownSession`
- From `round.ts`: `TenUpOneDownRoundRecord`
- From `summary.ts`: `TenUpOneDownSummary`

**Keep private (not in barrel):** `outcome.ts`, `target.ts` internals if only used inside module — export only what external consumers need (`resolveRoundOutcome` used by client play).

**External migration targets:**
- `[game].astro`, `ten-up-one-down.play.ts`, `complete.ts`, `Play.astro`, `api/types.ts`
- `tests/lib/shared/stats/double-stats.test.ts` — `TenUpOneDownRoundRecord` from barrel

- [ ] Same steps as Task 1
- [ ] Verification gate + `./scripts/curl-verify-tuod.sh`

---

## Phase 3 — `api/types.ts` consolidation

### Task 4: Finish api barrel imports

**Files:**
- Modify: `src/lib/shared/api/types.ts`

After Tasks 1–3, all game type imports should be:

```ts
import type { FiveOhOneSummary } from "@lib/shared/games/501";
import type { ScoreTrainingSession, ScoreTrainingSummary } from "@lib/shared/games/score-training";
import type { SinglesTrainingSummary } from "@lib/shared/games/singles-training";
import type { TenUpOneDownSummary } from "@lib/shared/games/ten-up-one-down";
```

- [ ] Replace remaining deep imports
- [ ] Verification gate

---

## Phase 4 — `[game].astro` import reduction

### Task 5: Slim `[game].astro` imports

**Files:**
- Modify: `src/pages/games/[game].astro`

After Tasks 1–3, each game block uses one barrel import:

```ts
import {
  buildScoreTrainingSession,
  parseScoreTrainingSettingsFormData,
  validateScoreTrainingSettings,
  type ScoreTrainingSession,
} from "@lib/shared/games/score-training";
// repeat for singles-training, ten-up-one-down
```

**Optional follow-up (Task 5b — defer):** `games/index.ts` aggregator re-exporting per-game settings→session helpers to collapse 4 imports to 1. Only worth it if slug-dispatch refactor is planned; handoff marks this priority 7.

- [ ] Migrate `[game].astro` to barrels (18 → ~8 import lines)
- [ ] Verification gate + curl smokes for all client-session games

---

## Phase 5 — Supporting module hygiene (optional, lower priority)

### Task 6: `lib/shared/darts` internal relative imports

**Files:**
- Modify: `checkout-solver.ts`, `checkouts.ts`, `checkout-constraints.ts`, `checkout-constraints.data.ts`

Replace `@lib/shared/darts/*` with `./` siblings.

- [x] Fix 5 internal absolute imports
- [x] Verification gate

### Task 7: `lib/shared/darts` barrel (optional)

Only if cross-module import count grows. Export: `getCheckoutHint`, `isFinishableCheckout`, `solveCheckoutConstraints`, `nearestNonBogey`, constraint helpers, key types.

- [x] Create `darts/types.ts` + `darts/index.ts` if proceeding
- [x] Migrate consumers (`501`, `dartbot`, `ten-up-one-down`, client play)
- [x] ESLint boundary
- [x] Verification gate

### Task 8: `lib/shared/stats` barrel (optional)

**Files:**
- Create: `src/lib/shared/stats/index.ts`
- Modify: `double-stats.ts` — `./types`
- Migrate: `ten-up-one-down/stats.ts`, server data, tests

- [x] Barrel + internal fix
- [x] Verification gate

---

## Phase 6 — Enforcement & cleanup

### Task 9: Astro import audit (decision required)

**Options (pick one during execution):**

| Option | Effort | Effect |
| ------ | ------ | ------ |
| A. Add `@eslint/astro` + lint `.astro` imports | Medium | Catches future deep imports in pages/components |
| B. Add `scripts/audit-imports.sh` (rg-based CI check) | Low | No new deps; runs in CI |
| C. Document-only | None | Rely on code review |

Recommendation: **B** for now — Astro ESLint adds config weight; rg audit is sufficient for 4 game Play shells + 2 page routes.

- [x] Implement chosen option
- [x] Document in handoff open questions

### Task 10: Legacy play-count block in `[game].astro`

**Files:**
- Modify: `src/pages/games/[game].astro` lines 45–57

Remove `incrementPlayCount` on page load once all released games use client-session completion pattern. Keep only if `121` or other server-session games need it before release.

- [x] Audit `SEED_GAMES` for non-client-session released games
- [x] Remove or narrow exclusion list
- [x] Verification gate

### Task 11: 501 `session.ts` cleanup (optional)

Remove redundant `export type { ... } from "./types"` re-exports from `session.ts`; barrel is canonical external surface.

- [x] Trim re-exports; ensure barrel still exports all types
- [x] Verification gate

### Task 12: Documentation sync

**Files:**
- `AGENTS.md` — move all 4 games to pilot-complete list; update rollout queue
- `module-barrels-types-handoff.md` — mark phases 2–4 complete, note Task 9 decision

- [x] Docs updated
- [x] Final full gate:

```bash
cd app
npm run check && npm test && npm run lint && npx fallow
./scripts/curl-verify-db.sh
./scripts/curl-verify-501.sh
./scripts/curl-verify-tuod.sh
```

---

## Execution Order Summary

```
Phase 2: Task 1 → Task 2 → Task 3   (one game module per session)
Phase 3: Task 4                     (after all game barrels)
Phase 4: Task 5                     (after Task 4)
Phase 5: Task 6–8                   (optional, any order)
Phase 6: Task 9–12                  (enforcement + cleanup)
```

**Estimated sessions:** 3 (games) + 1 (api + astro) + 1 (optional/support) = 4–5 focused agent sessions.

---

## Grep helpers (start of each game task)

```bash
cd app
rg "@lib/shared/games/score-training/" src tests scripts --glob '!src/lib/shared/games/score-training/**'
rg "@lib/shared/games/singles-training/" src tests scripts --glob '!src/lib/shared/games/singles-training/**'
rg "@lib/shared/games/ten-up-one-down/" src tests scripts --glob '!src/lib/shared/games/ten-up-one-down/**'
```

---

## Self-review

| Spec / AGENTS requirement | Task |
| ------------------------- | ---- |
| Hybrid `types.ts` | Tasks 1–3 |
| Full public API barrels | Tasks 1–3 |
| Internal `./` only | Tasks 1–3, 6 |
| Cross-module barrel imports | Tasks 1–4 |
| ESLint boundaries | Tasks 1–3, 7–8 |
| `api/types` from game barrels | Task 4 |
| Verification gate | Every task |
| Handoff doc updates | Tasks 1–3, 12 |

No placeholders. Each game task is self-contained with working software after verification.
