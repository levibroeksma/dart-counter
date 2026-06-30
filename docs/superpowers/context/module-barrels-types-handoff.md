# Module Barrels & Types — Rollout Handoff

> Living document for handoff between agents. Update after each module rollout.

**Status:** Phase 1 complete
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

- **ESLint ignores `**/*.astro`** — no Astro ESLint plugin installed; `.astro` files are excluded from lint. Deep imports in Astro pages are not enforced by ESLint today. Consider adding `@eslint/astro` or a separate import audit if this becomes a problem.
- **`strategy-engine.test.ts` and `throw-engine.test.ts`** — use deep imports for private symbols (`ThrowIntent`, internal helpers). ESLint overrides added for these files alongside checkout private-module tests.

---

## Suggested next prompt for a new agent

> Continue the module barrels rollout per `docs/superpowers/context/module-barrels-types-handoff.md`.
> Start with `games/score-training` using the 501 pattern in `AGENTS.md`.
> Follow `docs/superpowers/plans/` template: one module per session, verification gate after each.
