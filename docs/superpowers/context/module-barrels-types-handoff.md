# Module Barrels & Types — Rollout Handoff

> Living document for handoff between agents. Update after each module rollout.

**Status:** Phase 2–3 complete (all 4 game barrels + `darts` + `stats` + `api/types`); Phase 6 enforcement/cleanup complete (Tasks 9–11)
**Last updated:** 2026-06-30
**Branch:** 501-implementation
**Plan:** `docs/superpowers/plans/2026-06-30-module-barrels-types.md`
**Spec:** `docs/superpowers/specs/2026-06-30-module-barrels-types-design.md`
**Agent guide:** `AGENTS.md`

---

## What was done (phase 1)

- `games/501/types.ts` — domain types extracted
- `games/501/index.ts` — full public API barrel
- `games/501/settings.ts` — deleted (types-only file; precedent for future rollouts)
- `dartbot/index.ts` — public barrel (checkout subsystem private)
- `api/types.ts` — `FiveOhOneSummary` from 501 barrel (remaining game imports pending rollout)
- ESLint `no-restricted-imports` for `@lib/shared/games/501/*` and `@lib/shared/dartbot/*`
- `AGENTS.md` — module patterns documented; pilot modules marked complete

---

## What was done (phase 2 — score-training)

- `games/score-training/types.ts` — domain types extracted (`ScoreTrainingSettings`, session/state, round record, summary)
- `games/score-training/index.ts` — curated public barrel (mirrors 501)
- `games/score-training/settings.ts` — deleted (types-only file)
- `ValidateCompletedResult` renamed → `ValidateCompletedScoreTrainingResult` (501 naming pattern)
- External consumers migrated: `[game].astro`, client play, complete API, `api/types.ts`, Play/SettingsForm Astro, server data layer
- ESLint boundary for `@lib/shared/games/score-training/*` + internal override
- Test ESLint overrides for `validation.test.ts` (`validateVisitScore`) and `state.test.ts` (`createInitialGameState`, `isGameComplete`) — non-barrel exports

## What was done (phase 2 — singles-training)

- `games/singles-training/types.ts` — domain types extracted (settings, session/state, dart record, summary; `DartOutcome` co-located with `DartRecord`)
- `games/singles-training/index.ts` — curated public barrel (mirrors 501/score-training)
- `games/singles-training/settings.ts` — deleted (types-only file)
- `ValidateCompletedSinglesResult` renamed → `ValidateCompletedSinglesTrainingResult` (501 naming pattern)
- External consumers migrated: `[game].astro`, client play, complete API, `api/types.ts`, Play/SettingsForm Astro, server data layer
- ESLint boundary for `@lib/shared/games/singles-training/*` + internal override
- Test ESLint overrides for private symbols: `dart.test.ts`, `target-sequence.test.ts`, `state.test.ts` (`createInitialGameState`, `getMinimumHitsForMode`), `summary.test.ts`, `stats.test.ts`, `session-factory.test.ts`, `completion.test.ts` (`ALL_TARGETS`)

## What was done (phase 2 — ten-up-one-down)

- `games/ten-up-one-down/types.ts` — domain types extracted (settings, session/state, round record, summary, completion reason)
- `games/ten-up-one-down/index.ts` — curated public barrel (mirrors 501/score-training/singles-training)
- `games/ten-up-one-down/settings.ts` — deleted (types-only file)
- `ValidateCompletedResult` renamed → `ValidateCompletedTenUpOneDownResult` (501 naming pattern)
- External consumers migrated: `[game].astro`, client play, complete API, `api/types.ts`, Play/SettingsForm Astro, `double-stats.ts`
- ESLint boundary for `@lib/shared/games/ten-up-one-down/*` + internal override
- Test ESLint overrides for private symbols: `state.test.ts` (`createInitialGameState`), `target.test.ts` (`resolveTargetAfterRound`)

## What was done (phase 3 — darts)

- `darts/index.ts` — curated public barrel (no `types.ts`; types re-exported from logic files)
- External consumers migrated: 501/TUOD client play, 501 `visit`/`bot-play`, TUOD `target`, `TargetCard.astro`, dartbot `strategy-engine`
- ESLint boundary for `@lib/shared/darts/*` + internal override
- Test ESLint override for `doubles.test.ts` (`ALL_DOUBLES` — private, test-only)
- `CHECKOUT_HINTS` remains deep import inside dartbot (`GeneratedCheckoutKnowledge.ts`; dartbot module override)

## What was done (phase 3 — stats)

- `stats/index.ts` — curated public barrel (types from `types.ts`; double-stats helpers)
- External consumers migrated: TUOD `stats.ts`, server `player-dart-stats.ts`, related tests
- ESLint boundary for `@lib/shared/stats/*` + internal override
- `double-stats.ts` internal import changed to `./types`

## What was done (phase 3 — api/types consolidation)

- `api/types.ts` — all game session/summary types from per-game barrels (no deep game imports)

## What was done (phase 6 — Task 9: import audit)

- `scripts/audit-imports.sh` — rg-based check for forbidden deep imports in `src/` and `tests/` (including `*.astro`)
- Mirrors ESLint `no-restricted-imports` boundaries and the same test-file allowlist
- Chose Option B over `@eslint/astro` (see `2026-06-30-shared-module-optimization.md` Task 9)
- Run: `cd app && ./scripts/audit-imports.sh`

## What was done (phase 6 — Task 10: play-count removal)

- Removed legacy `incrementPlayCount` on page load from `[game].astro`
- All released games use client-session completion pattern (play count on complete API only)

## What was done (phase 6 — Task 11: 501 session cleanup)

- Removed redundant `export type { ... } from "./types"` re-exports from `games/501/session.ts`
- Barrel is canonical external surface for 501 types

---

## Rollout queue (priority order)

| Priority | Module | Deep-import pain | Notes |
| -------- | ------ | ---------------- | ----- |
| 1 | ~~`games/score-training`~~ | ~~done~~ | Complete — mirror 501 |
| 2 | ~~`games/singles-training`~~ | ~~done~~ | Complete — mirror 501 |
| 3 | ~~`games/ten-up-one-down`~~ | ~~done~~ | Complete — mirror 501 |
| 4 | ~~`api/types.ts`~~ | ~~done~~ | All game types from barrels |
| 5 | ~~`lib/shared/stats`~~ | ~~done~~ | Complete — `PlayerDartStats` + double-stats helpers |
| 6 | ~~`lib/shared/darts`~~ | ~~done~~ | Complete — checkout/bogey helpers |
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
9. Run: `cd app && npm run check && npm test && npm run lint && npx fallow && ./scripts/audit-imports.sh`

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

- **ESLint ignores `**/*.astro`** — no Astro ESLint plugin installed; `.astro` files are excluded from lint. Deep imports in Astro are covered by `audit-imports.sh` instead.
- **`strategy-engine.test.ts` and `throw-engine.test.ts`** — use deep imports for private symbols (`ThrowIntent`, internal helpers). ESLint overrides added for these files alongside checkout private-module tests.
- **score-training barrel** — exports `revertRoundFromState` and `PlayerScoreTrainingStats` (needed by client play and server data layer; not in original spec list but required for external consumers). `validateVisitScore`, `createInitialGameState`, `isGameComplete` remain private (test overrides).
- **singles-training barrel** — exports `formatDartOutcomeLabel`, `isValidOutcomeForTarget`, `revertLastDart`, and `PlayerSinglesTrainingStats` (needed by client play and server data layer). `createInitialGameState`, `getMinimumHitsForMode`, `buildTargetSequence`, `ALL_TARGETS`, and dart internals remain private (test overrides).
- **ten-up-one-down barrel** — exports `revertRoundFromState` and `resolveRoundOutcome` (needed by client play). No `createEmpty*` stats (uses shared `PlayerDartStats` via `double-stats`). `createInitialGameState`, `resolveTargetAfterRound`, `RoundInput`, and `TargetResolution` remain private (test overrides).
- **darts barrel** — types (`CheckoutConstraint`, `CheckoutRoute`, `ModalQuestion`) re-exported from logic files. `CHECKOUT_HINTS`, `ALL_DOUBLES`, and constraint data tables remain private. Dartbot `GeneratedCheckoutKnowledge.ts` keeps deep import of `checkout-hints.data` (dartbot module override).
- **stats barrel** — exports `PlayerDartStats` from `types.ts` and `createEmptyPlayerDartStats`, `applyRoundToStats`, `revertRoundFromStats` from `double-stats.ts`. No private symbols or test overrides needed.

---

## Suggested next prompt for a new agent

> Module barrels rollout is complete for all pilot modules. Optional follow-up: `games/index.ts` aggregator to collapse `[game].astro` per-game imports (priority 7 — deferred).
> For new shared modules, follow `AGENTS.md` checklist: `types.ts` + barrel + ESLint boundary + `audit-imports.sh` allowlist update.
> Run full gate: `cd app && npm run check && npm test && npm run lint && npx fallow && ./scripts/audit-imports.sh`
