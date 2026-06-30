# 501 Play Flow Fixes — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-30  
**Scope:** Checkout/double tracking modal, DartBot UI polish, dart-count accuracy, completion API fix, play UX bug fixes  
**Builds on:** `docs/superpowers/specs/2026-06-29-501-design.md`, `docs/superpowers/specs/2026-06-29-dartbot-design.md`

**UI reference:** `app/src/components/games/ten-up-one-down/Play.astro` (checkout modal), `app/src/components/ui/OptionModal.astro`

**Approach:** Shared domain logic in `lib/shared/games/501/` + `lib/shared/darts/`; defer `applyVisit` until modal confirms (TUOD pattern); targeted bug fixes in `501.play.ts` and completion replay.

---

## 1. Problem statement

Several gaps and bugs block a correct 501 play experience:

| Issue | Symptom |
| ----- | ------- |
| No checkout modal | Cannot track darts on double / checkout darts for checkout % |
| DartBot level hidden | UI shows `DartBot` without skill level |
| Dart counts wrong | Bust visits add 0 darts; bot/user totals drift |
| Completion 400 | `POST /api/games/501/complete` fails (DartBot sessions: `botRngBefore` replay mismatch) |
| Back button stuck | Summary Back disabled when persist fails (`persisting` never reset) |
| Bot animation | 3rd dart not visible; pacing too fast |
| Empty submit | Submit with no score does nothing |
| Undo after leg | Undo unavailable after leg win when DartBot starts next leg |
| DB migration | Missing `player_501_stats` table causes runtime failures after pull |

---

## 2. Checkout modal

### 2.1 Flow

1. User submits visit score (`null`/empty → `0`).
2. `resolve501CheckoutModal(remainingBefore, visitScore, outcome)` returns `null` or modal descriptor.
3. If modal required → open modal, **do not** call `applyVisit`.
4. User answers questions → `modalSubmit` → `applyVisit(session, visitScore, metadata)` → clear score → bot turn / match completion as today.
5. While modal is open, visit is not committed — user can dismiss modal or undo to edit score.

### 2.2 Trigger rules

| Kind | Condition | Questions |
| ---- | --------- | --------- |
| `finish` | Valid checkout (`outcome.checkout === true`) | `dartsForFinish` + `dartsOnDouble` via `buildSuccessModalQuestions(remainingBefore)` |
| `partial` | `isFinishableCheckout(remainingBefore)` AND `remainingAfter` is single-dart finishable (`getCheckoutConstraints(remainingAfter)?.minFinish === 1`) AND not checkout | `dartsOnDouble` only |
| none | All other visits | — |

**Examples**

| Start | Score | End | Modal? |
| ----- | ----- | --- | ------ |
| 60 | 13 | 47 | Yes — partial (`dartsOnDouble` 0–1) |
| 54 | 14 | 40 | Yes — partial (`dartsOnDouble` 0–2) |
| 60 | 40 | 20 | Yes — partial (`dartsOnDouble` 0–2; capped when leaving single-dart finish) |
| 60 | 9 | 51 | No |
| 32 | 32 | 0 | Yes — finish |
| 40 | 0 | 40 (bust) | Yes — partial (`dartsOnDouble` 0–3) |

### 2.3 Partial modal options

New `maxDartsOnDoubleForPartialVisit(visitScore)` in `@lib/shared/darts`:

- `visitScore === 0` → `3`
- else → `min(3, ceil(visitScore / 13))`
- when `remainingAfter` is single-dart finishable → cap at `2` (at least one setup dart required)

Locked by unit tests for 60→47 (max 1) and 54→40 (max 2).

New `buildPartialDoubleModalQuestion(visitScore): ModalQuestion` returns `{ id: "dartsOnDouble", label: "Darts on double", options: [0..max] }`.

### 2.4 Visit record fields

Extend `FiveOhOneVisitRecord`:

```ts
dartsThrown: number;           // 1–3
dartsOnDouble?: number;        // when modal shown or bot-derived
dartsForFinish?: number;       // successful checkout only
```

`applyVisit` accepts optional metadata; defaults `dartsThrown` to `3` when omitted (replay of legacy visits in tests).

---

## 3. Darts counting

| Visit type | `dartsThrown` |
| ---------- | ------------- |
| Normal (no modal) | 3 |
| Bust (no modal) | 3 (fix: today adds 0) |
| Finish modal | `dartsForFinish` |
| Partial modal | 3 |
| DartBot | `simulatedVisit.darts.length` |

`dartsThisLeg` increments by `dartsThrown` on every non-bust visit; bust visits still increment `dartsThrown` (3 for user bust without modal).

`buildSummary` / `getPlayerSummaryStats` sum `visit.dartsThrown` instead of `visits.length * 3`.

---

## 4. Stats persistence (option C)

On `POST /api/games/501/complete`, after `player_501_stats` save, also update `player_dart_stats` for the logged-in user:

| Visit | `doubleAttempts` | `doubleHits` | `totalCheckouts` | `totalCheckoutDarts` |
| ----- | ---------------- | ------------ | ---------------- | -------------------- |
| Partial (`dartsOnDouble` only) | `+= dartsOnDouble` | — | — | — |
| Successful checkout | `+= dartsOnDouble` | `+= 1` | `+= 1` | `+= dartsForFinish` |

Only **user** visits contribute (guest/DartBot excluded from global dart stats).

New `apply501VisitToDartStats` in `lib/shared/games/501/dart-stats.ts`; `applyGameCompletionToDartStats` iterates user visits.

---

## 5. DartBot

### 5.1 Display name

In play UI: `DartBot - lvl ${level}` when `player.type === "dartbot"`. Helper `format501PlayerDisplayName(player)` in `lib/shared/games/501/display.ts`.

### 5.2 Auto dart metadata

`deriveBotVisitDartMetadata(visit: SimulatedVisit)`:

- `dartsThrown` = checkout ? finishing dart count : `visit.darts.length` (non-checkout bot visit that ends early still uses actual dart count; checkout uses darts in visit)
- `dartsOnDouble` = count of darts where `actual.ring` is `double` or `bull`
- `dartsForFinish` = `dartsThrown` when `visit.checkout`

No modal for DartBot turns.

### 5.3 Animation

- `dartMs` default `800` (was `550`)
- New `holdMs` default `600` after last dart before modal closes
- `onComplete` fires after hold; modal stays open during hold

---

## 6. Bug fixes

### 6.1 Completion replay (`botRngBefore`)

`validateCompletedFiveOhOneSession` replay loop passes `{ botRngBefore: submittedVisit.botRngBefore }` to `applyVisit` when present.

`visitsMatch` compares gameplay fields only (exclude `stateSnapshot`; compare `botRngBefore` only when submitted visit has it).

### 6.2 Persist error / Back button

`persistCompletion`: set `persisting = false` on error response or network failure.

`Summary.astro`: Back uses `@click="backToGames()"` button (not `<a>` with `pointer-events-none`); `backToGames` navigates even after failed persist (session already cleared client-side only on success).

### 6.3 Empty submit

`submitVisit`: `validateVisitScore(this.score ?? 0)`.

### 6.4 Undo after leg win (DartBot)

`canUndoDartBotPair`: also true when last visit is a user checkout and bot is current player on new leg (single user visit at end of history, user visit has `checkout: true`).

`revertLastOpponentPair` unchanged for pair undo; add `revertLastUserVisit` path or extend undo to revert single user checkout visit when bot hasn't thrown yet on new leg.

**Undo rule:** If last visit is user checkout and `isDartBotTurn(session)` and bot has not thrown this leg → `revertLastVisit` (single visit). Else existing pair logic.

### 6.5 AGENTS.md

Under Verification / Neon dev branches: **mandatory** `npm run db:migrate` after pulling migrations before testing completion APIs locally.

---

## 7. UI components

- Add `OptionModal` to `501/Play.astro` (mirror TUOD wiring).
- Modal state in `fiveOhOnePlay`: `showModal`, `modalKind`, `modalQuestions`, `dartsOnDouble`, `dartsForFinish`, `pendingVisitScore`.
- `controlsDisabled` includes `showModal`.

---

## 8. Testing

| Layer | Coverage |
| ----- | -------- |
| `darts` | `maxDartsOnDoubleForPartialVisit`, `buildPartialDoubleModalQuestion`, `isSingleDartFinishable` |
| `games/501` | `resolve501CheckoutModal`, `deriveBotVisitDartMetadata`, `applyVisit` darts/bust, `apply501VisitToDartStats`, completion replay with `botRngBefore`, undo after leg |
| `501.play` | Modal defer, empty submit, persist error resets `persisting`, display name |
| API | `complete.ts` saves `player_dart_stats` |
| Assembly | `Play.astro` OptionModal wiring |
| Curl | Extend `curl-verify-501.sh` with dartbot completion smoke if feasible |

---

## 9. Out of scope

- Refactoring TUOD into shared checkout-modal factory
- New DB columns on `player_501_stats` (use existing `player_dart_stats`)
- DartBot checkout modal (auto-derived only)
- Guest player double stats persistence

---

## 10. File map

| File | Change |
| ---- | ------ |
| `lib/shared/darts/checkout-partial.ts` | `maxDartsOnDoubleForPartialVisit`, `buildPartialDoubleModalQuestion`, `isSingleDartFinishable` |
| `lib/shared/darts/index.ts` | export new helpers |
| `lib/shared/games/501/types.ts` | visit dart fields |
| `lib/shared/games/501/checkout-modal.ts` | `resolve501CheckoutModal` |
| `lib/shared/games/501/display.ts` | `format501PlayerDisplayName` |
| `lib/shared/games/501/bot-dart-metadata.ts` | `deriveBotVisitDartMetadata` |
| `lib/shared/games/501/dart-stats.ts` | `apply501VisitToDartStats`, `applyGameCompletionToDartStats` |
| `lib/shared/games/501/state.ts` | darts metadata + bust dart count |
| `lib/shared/games/501/completion.ts` | replay `botRngBefore`, visitsMatch |
| `lib/shared/games/501/summary.ts` | sum `dartsThrown` |
| `lib/shared/games/501/bot-helpers.ts` | undo after leg |
| `lib/shared/games/501/index.ts` | barrel exports |
| `lib/client/alpine/games/501.play.ts` | modal flow, bugs |
| `lib/client/alpine/games/dartbot-turn-modal.ts` | timing |
| `components/games/501/Play.astro` | OptionModal, display names |
| `components/games/501/Summary.astro` | Back button |
| `pages/api/games/501/complete.ts` | `player_dart_stats` |
| `AGENTS.md` | migration note |
| `scripts/curl-verify-501.sh` | optional dartbot complete check |
