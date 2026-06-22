# Score Training Play Again Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `playAgain()` so a completed score-training game can restart with the same settings after stats are persisted.

**Architecture:** Stats and play count are already saved in `persistCompletion()` when the game ends (before the summary panel appears). `playAgain()` does not call the completion API again — it only builds a fresh in-memory session from the completed game's `settings` via `buildScoreTrainingSession`, resets Alpine play state, and re-starts the timer for timed mode. No new API route is needed (unlike singles-training, which is DB-session-backed).

**Tech Stack:** Astro 6, Alpine.js 3, `@alpinejs/persist`, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-06-19-score-training-client-session-design.md` (completion-on-end); this plan extends it with play-again behaviour.

**Working directory:** `app/`

---

## File Map

| File | Responsibility |
| ---- | -------------- |
| `src/lib/client/alpine/games/score-training.play.ts` | Add `playAgain()` — reset session + UI state |
| `src/components/games/score-training/Summary.astro` | Disable Yes/No while `loading` (match singles pattern) |
| `src/components/games/score-training/Play.astro` | Pass `loadingModel="loading"` to `Summary` |
| `tests/lib/client/alpine/games/score-training.play.test.ts` | Unit tests for `playAgain()` |

**Not modified:** `/api/games/score-training/complete.ts` — already handles save on game end.

---

## Data Flow

```
Game ends (rounds complete or timer expiry)
  → showSummary = true, summary = null (skeleton)
  → persistCompletion() POST /api/games/score-training/complete
      → save stats + increment play count
      → summary populated, persist cleared
  → Summary panel visible (showSummary && summary)

User clicks "Yes" (playAgain)
  → guard: session && summary must exist (completion already saved)
  → session = buildScoreTrainingSession(session.settings)
  → showSummary = false, summary = null, score = null, timerExpired = false
  → startTimer() if timed mode, else stopTimer()
  → $persist auto-syncs new active session to sessionStorage
```

**Completion failure path (unchanged):** If `persistCompletion()` fails, `summary` stays `null` and the user sees `SummarySkeleton` + error — the play-again button is not shown. Retry belongs to a separate UX change, not this plan.

---

### Task 1: `playAgain()` in Alpine play controller

**Files:**
- Modify: `app/src/lib/client/alpine/games/score-training.play.ts`
- Test: `app/tests/lib/client/alpine/games/score-training.play.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `score-training.play.test.ts`:

```typescript
import { buildScoreTrainingSession } from "@lib/shared/games/score-training/session-factory";

// ... inside describe("scoreTrainingPlay"):

it("restarts with same settings via playAgain without fetch", () => {
  const completedSession = buildScoreTrainingSession({
    endMode: "rounds",
    roundCount: 1,
  });
  completedSession.state = {
    currentRound: 2,
    currentScore: 60,
    status: "completed",
    lastScore: 60,
  };
  completedSession.roundHistory = [
    { roundNumber: 1, visitScore: 60, runningTotal: 60 },
  ];

  const play = scoreTrainingPlay(completedSession);
  play.init();
  play.showSummary = true;
  play.summary = {
    totalScore: 60,
    threeDartAverage: 60,
    roundsPlayed: 1,
    dartsThrown: 3,
  };

  play.playAgain();

  expect(fetch).not.toHaveBeenCalled();
  expect(play.showSummary).toBe(false);
  expect(play.summary).toBeNull();
  expect(play.score).toBeNull();
  expect(play.timerExpired).toBe(false);
  expect(play.session?.settings).toEqual({ endMode: "rounds", roundCount: 1 });
  expect(play.session?.state.status).toBe("active");
  expect(play.session?.roundHistory).toEqual([]);
  expect(play.session?.state.currentRound).toBe(1);
});

it("playAgain no-ops when summary is missing", () => {
  const play = scoreTrainingPlay(structuredClone(roundsSession));
  play.init();
  play.showSummary = true;
  play.summary = null;

  play.playAgain();

  expect(play.showSummary).toBe(true);
  expect(play.session?.state.status).toBe("active");
});

it("playAgain resets timed session timer", () => {
  vi.useFakeTimers();
  const completedTimed = buildScoreTrainingSession({
    endMode: "timed",
    playtimeSeconds: 90,
  });
  completedTimed.state.status = "completed";
  completedTimed.timeRemainingSeconds = 0;

  const play = scoreTrainingPlay(completedTimed);
  play.init();
  play.showSummary = true;
  play.summary = {
    totalScore: 0,
    threeDartAverage: 0,
    roundsPlayed: 0,
    dartsThrown: 0,
  };

  play.playAgain();

  expect(play.session?.timeRemainingSeconds).toBe(90);
  expect(play.session?.state.status).toBe("active");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/client/alpine/games/score-training.play.test.ts -v`

Expected: FAIL — `play.playAgain is not a function`

- [ ] **Step 3: Implement `playAgain()`**

In `score-training.play.ts`, add import:

```typescript
import { buildScoreTrainingSession } from "@lib/shared/games/score-training/session-factory";
```

Add method to the returned object (after `persistCompletion`):

```typescript
playAgain() {
  if (!this.session || !this.summary) return;

  const settings = this.session.settings;
  this.session = buildScoreTrainingSession(settings);
  this.showSummary = false;
  this.summary = null;
  this.score = null;
  this.timerExpired = false;
  this.error = "";

  if (this.session.settings.endMode === "timed") {
    this.startTimer();
  } else {
    this.stopTimer();
  }
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/client/alpine/games/score-training.play.test.ts -v`

Expected: PASS (all tests in file)

- [ ] **Step 5: Run full test suite**

Run: `cd app && npm test`

Expected: all tests PASS

---

### Task 2: Disable summary actions while loading

**Files:**
- Modify: `app/src/components/games/score-training/Summary.astro`
- Modify: `app/src/components/games/score-training/Play.astro`

- [ ] **Step 1: Add `loadingModel` prop to Summary**

In `Summary.astro`, extend props (mirror singles-training):

```astro
interface Props {
  showSummaryModel?: string;
  summaryModel?: string;
  summaryAverageDisplayModel?: string;
  loadingModel?: string;
}

const {
  showSummaryModel = "showSummary",
  summaryModel = "summary",
  summaryAverageDisplayModel = "summaryAverageDisplay",
  loadingModel = "loading",
} = Astro.props;
```

Update buttons:

```astro
<a
  href="/games"
  class="btn-secondary btn-press font-medium flex items-center justify-center"
  :class={loadingModel + " && 'pointer-events-none opacity-50'"}
>
  <span>No</span>
</a>
<button
  type="button"
  class="btn-primary btn-press"
  :disabled={loadingModel}
  @click="playAgain()"
>
  Yes
</button>
```

Note: `<a>` cannot use `:disabled`; use `:class` opacity guard like singles uses `:disabled` on its No button (singles uses a `<button>` for No — score-training uses `<a>`. The class guard prevents double-navigation during loading).

- [ ] **Step 2: Pass `loadingModel` from Play**

In `Play.astro`, change:

```astro
<Summary showSummaryModel="showSummary && summary" />
```

to:

```astro
<Summary showSummaryModel="showSummary && summary" loadingModel="loading" />
```

- [ ] **Step 3: Verify assembly**

Run: `cd app && npm test -- tests/pages/score-training-play-assembly.test.ts -v`

Expected: PASS

Run: `cd app && npm run check`

Expected: no type errors

---

### Task 3: Manual smoke test

- [ ] **Step 1: Rounds mode**

1. `npm run dev` from `app/`
2. Start a 1-round score-training game
3. Submit a score → summary appears
4. Click **Yes** → play UI returns, round 1, score 0, same round count setting
5. Complete second game → stats increment (check DB or repeat flow)

- [ ] **Step 2: Timed mode**

1. Start a 1-minute timed game
2. Let timer expire (or score until complete)
3. Click **Yes** → timer resets to full duration and counts down

- [ ] **Step 3: Refresh after play again**

1. Play again → submit one score → refresh page
2. Game should resume from persisted session (not redirect to settings)

---

## Self-Review Checklist

| Requirement | Task |
| ----------- | ---- |
| Stats saved before play-again is possible | Existing `persistCompletion()` — no change |
| New game with same settings | Task 1 `buildScoreTrainingSession(settings)` |
| Timer restarts for timed mode | Task 1 `startTimer()` branch |
| No duplicate completion POST | Task 1 test asserts `fetch` not called |
| Summary button wired | Already in `Summary.astro` `@click="playAgain()"` |
| Loading guard on buttons | Task 2 |

---

## Execution Handoff

**Plan saved to `docs/superpowers/plans/2026-06-22-score-training-play-again.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — implement all tasks in this session with checkpoints

Which approach?
