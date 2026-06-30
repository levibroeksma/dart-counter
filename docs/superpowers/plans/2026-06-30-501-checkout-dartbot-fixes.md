# 501 Checkout Modal & DartBot Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix partial/finish checkout modal constraints, DartBot turn after modal submit, DartBot throw realism at low levels, and add checkout % to 501 summary.

**Architecture:** Shared domain logic in `lib/shared/darts/checkout-partial.ts` and `lib/shared/games/501/checkout-modal.ts`; Alpine UX in `501.play.ts`; DartBot scoring in `route-engine.ts`; summary in `games/501/summary.ts`.

**Tech Stack:** Astro 6, Alpine.js 3, Vitest, TypeScript

**Specs:** `docs/superpowers/specs/2026-06-30-501-play-flow-fixes-design.md`, `docs/superpowers/specs/2026-06-29-dartbot-design.md`, TUOD `doubleHitPercentage` pattern

---

## Task 1: Partial modal max options

**Files:**
- Modify: `app/src/lib/shared/darts/checkout-partial.ts`
- Modify: `app/src/lib/shared/games/501/checkout-modal.ts`
- Modify: `app/src/lib/shared/darts/index.ts` (if signature changes)
- Test: `app/tests/lib/shared/darts/checkout-partial.test.ts`
- Test: `app/tests/lib/shared/games/501/checkout-modal.test.ts`

**Problem:** `maxDartsOnDoubleForPartialVisit(40)` returns 3; when leaving single-dart finish (20), max should be 2.

**Change:**
```ts
maxDartsOnDoubleForPartialVisit(visitScore, remainingAfter?)
  if visitScore === 0 → 3
  base = min(3, ceil(visitScore / 13))
  if remainingAfter !== undefined && isSingleDartFinishable(remainingAfter) → min(base, 2)
```

Pass `remainingAfter` from `resolve501CheckoutModal` → `buildPartialDoubleModalQuestion`.

**Tests:**
- `60→40` leaves 20: options `[0,1,2]`
- `60→47` leaves 47: still `[0,1]`
- `54→40`: still `[0,1,2]`
- `40→0` bust score 0: still `[0,1,2,3]`

---

## Task 2: Finish modal auto-link darts on double

**Files:**
- Modify: `app/src/lib/client/alpine/games/501.play.ts`
- Modify: `app/src/components/games/501/Play.astro` (if click handler needs update)
- Test: `app/tests/lib/client/alpine/games/501.play.test.ts`

**Rule:** When `minFinish === 1` and user selects `dartsForFinish === 1`, auto-set `dartsOnDouble = 1`. When `dartsForFinish` changes, clamp `dartsOnDouble` to `<= dartsForFinish`.

**Approach:** Add `selectDartsForFinish(n)` in `501.play.ts`; wire Play.astro click to it.

---

## Task 3: DartBot turn after partial modal

**Files:**
- Test: `app/tests/lib/client/alpine/games/501.play.test.ts`
- Modify: `app/src/lib/client/alpine/games/501.play.ts` (only if test reveals bug)

**Test:** DartBot session, user at 60, score 40, partial modal, `dartsOnDouble=0`, `modalSubmit` → `visitHistory.length === 2`, second visit is dartbot; `runDartBotTurn` called.

Fix any gap found in `modalSubmit` → `commitVisit` → `runDartBotTurn` chain.

---

## Task 4: DartBot throw realism (route-engine)

**Files:**
- Modify: `app/src/lib/shared/dartbot/route-engine.ts`
- Test: `app/tests/lib/shared/dartbot/strategy-engine.test.ts`
- Test: `app/tests/lib/shared/dartbot/dart-bot.test.ts` (if needed)

**Change:** Default primary target T20; shift to T19/T18 by level/missSpread per dartbot spec. Remove leg-target optimization that picks S5/S10 as primary aim.

**Tests:** Level 2 expects triple-ring primary (T20/T19/T18), not single.

---

## Task 5: Summary checkout %

**Files:**
- Modify: `app/src/lib/shared/games/501/types.ts`
- Modify: `app/src/lib/shared/games/501/summary.ts`
- Modify: `app/src/components/games/501/Summary.astro`
- Test: `app/tests/lib/shared/games/501/summary.test.ts`

**Formula:** `doubleAttempts = sum(user visits.dartsOnDouble)`; `checkoutPercentage = doubleAttempts === 0 ? 0 : (checkouts / doubleAttempts) * 100`

Display as "Checkout %" with one decimal (match TUOD `doubleHitPercentage` semantics).

---

## Verification gate

```bash
cd app && npm run check && npm test && npm run lint
./scripts/curl-verify-501.sh
```
