# 501 Summary Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `FiveOhOneSummary` into a per-player array with richer stats, implement the two-player head-to-head summary UI from `test.astro`, update single-player stats display, and extract shared summary components rolled into all game summaries.

**Architecture:** Replace flat legacy summary fields with `players[]` built in `buildSummary`. Shared Astro primitives (`SummaryMatchHeader`, `SummaryComparisonStatRow`, `SummaryActions`) live under `components/games/`. 501-specific layout bodies live in `MultiplayerSummary.astro` and `SinglePlayerSummary.astro`; `501/Summary.astro` is a thin orchestrator that branches on `players.length`. Alpine helpers in `501.play.ts` format `null` as `-`. Other games adopt `SummaryActions` only.

**Tech Stack:** Astro 6, Alpine.js 3, TypeScript, Vitest, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-06-30-501-summary-redesign-design.md`  
**UI reference:** `app/src/pages/test.astro` (canonical classes — do not change)  
**Working directory:** `app/`

---

## File Structure Overview

| File | Responsibility |
| ---- | -------------- |
| `src/lib/shared/games/501/types.ts` | `FiveOhOnePlayerSummary`, new `FiveOhOneSummary` shape |
| `src/lib/shared/games/501/summary.ts` | All stat computation in `buildSummary` |
| `src/lib/shared/games/501/stats.ts` | Read `players[0]` for checkouts + match average |
| `src/lib/shared/games/501/index.ts` | Export `FiveOhOnePlayerSummary` |
| `src/components/games/SummaryComparisonStatRow.astro` | 5-column comparison grid row |
| `src/components/games/SummaryMatchHeader.astro` | 3-column avatar / winner / vs header |
| `src/components/games/SummaryActions.astro` | Shared footer buttons (`back-play` / `yes-no`) |
| `src/components/games/PlayerAvatar.astro` | Optional `nameExpr` for Alpine-bound names |
| `src/components/games/501/MultiplayerSummary.astro` | 2P head-to-head stat grid |
| `src/components/games/501/SinglePlayerSummary.astro` | 1P centered winner + stat rows |
| `src/components/games/501/Summary.astro` | Thin orchestrator: branch + `SummaryActions` |
| `src/lib/client/alpine/games/501.play.ts` | Summary display format helpers |
| `src/components/games/score-training/Summary.astro` | Adopt `SummaryActions` |
| `src/components/games/singles-training/Summary.astro` | Adopt `SummaryActions` |
| `src/components/games/ten-up-one-down/Summary.astro` | Adopt `SummaryActions` |
| `tests/lib/shared/games/501/summary.test.ts` | New stats + null edge cases |
| `tests/lib/shared/games/501/stats.test.ts` | Updated consumer assertions |
| `tests/api/games/501/complete.test.ts` | New summary JSON shape |
| `tests/pages/501-play-assembly.test.ts` | Two-player wiring strings |
| `tests/pages/score-training-play-assembly.test.ts` | `SummaryActions` import |
| `tests/pages/singles-training-play-assembly.test.ts` | `SummaryActions` import |
| `tests/pages/ten-up-one-down-play-assembly.test.ts` | `SummaryActions` import |
| `scripts/curl-verify-501.sh` | Assert new summary field |

---

## Verification Gate (final task)

```bash
cd app && npm run check && npm test && npx fallow && npm run lint && ./scripts/audit-imports.sh
```

With dev server running in another terminal:

```bash
cd app && ./scripts/curl-verify-501.sh
```

Scoped during steps: `npm test -- tests/lib/shared/games/501/summary.test.ts`

---

### Task 1: Summary types

**Files:**
- Modify: `app/src/lib/shared/games/501/types.ts`
- Modify: `app/src/lib/shared/games/501/index.ts`

- [ ] **Step 1: Replace `FiveOhOneSummary` and add `FiveOhOnePlayerSummary`**

In `types.ts`, replace the existing `FiveOhOneSummary` type (lines 89–101) with:

```ts
export type FiveOhOnePlayerSummary = {
  playerId: string;
  displayName: string;
  isBot: boolean;
  isGuest: boolean;
  isWinner: boolean;
  setsWon: number;
  legsWon: number;
  threeDartAverage: number;
  firstNineAverage: number | null;
  checkoutRate: number | null;
  checkoutsMade: number;
  checkoutAttempts: number;
  highestFinish: number | null;
  highestScore: number | null;
  bestLegDarts: number | null;
  worstLegDarts: number | null;
};

export type FiveOhOneSummary = {
  winnerDisplayName: string;
  showSetsRow: boolean;
  players: FiveOhOnePlayerSummary[];
};
```

- [ ] **Step 2: Export new type from barrel**

In `index.ts`, add `FiveOhOnePlayerSummary` to the type exports block:

```ts
export type {
  FiveOhOnePlayerSummary,
  // ...existing exports
} from "./types";
```

- [ ] **Step 3: Run typecheck**

Run: `cd app && npm run check`  
Expected: FAIL — `summary.ts` and consumers still reference legacy fields

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/games/501/types.ts src/lib/shared/games/501/index.ts
git commit -m "refactor(501): replace summary types with players array model"
```

---

### Task 2: Stat computation helpers

**Files:**
- Modify: `app/src/lib/shared/games/501/summary.ts`
- Test: `app/tests/lib/shared/games/501/summary.test.ts`

- [ ] **Step 1: Write failing tests for new stats**

Add to `summary.test.ts` (keep file imports; tests will fail until Task 3):

```ts
function buildMinimalCompletedSession(
  players: Parameters<typeof buildFiveOhOneSession>[0]["players"],
) {
  const session = buildFiveOhOneSession({
    matchMode: "first-to",
    targetCount: 1,
    unit: "legs",
    players,
  });
  session.state.status = "completed";
  session.state.phase = "summary";
  return session;
}

it("returns players array with one entry for 1-player match", () => {
  const session = buildMinimalCompletedSession([
    { id: "u1", type: "user", name: "Levi" },
  ]);
  session.visitHistory = [
    {
      visitNumber: 1,
      playerId: "u1",
      visitScore: 180,
      remainingBefore: 501,
      remainingAfter: 321,
      bust: false,
      checkout: false,
      legNumber: 1,
      setNumber: 1,
      dartsThrown: 3,
      stateSnapshot: structuredClone(session.state),
    },
    {
      visitNumber: 2,
      playerId: "u1",
      visitScore: 321,
      remainingBefore: 321,
      remainingAfter: 0,
      bust: false,
      checkout: true,
      legNumber: 1,
      setNumber: 1,
      dartsThrown: 3,
      dartsOnDouble: 1,
      stateSnapshot: structuredClone(session.state),
    },
  ];
  session.state.players[0].totalLegsWon = 1;

  const summary = buildSummary(session);

  expect(summary.winnerDisplayName).toBe("Levi");
  expect(summary.showSetsRow).toBe(false);
  expect(summary.players).toHaveLength(1);
  expect(summary.players[0]).toMatchObject({
    playerId: "u1",
    displayName: "Levi",
    isBot: false,
    isGuest: false,
    isWinner: true,
    legsWon: 1,
    threeDartAverage: 250.5,
    checkoutsMade: 1,
    checkoutAttempts: 1,
    checkoutRate: 100,
    highestFinish: 321,
    highestScore: 321,
    bestLegDarts: 6,
    worstLegDarts: 6,
  });
});

it("returns null firstNineAverage when player has fewer than 3 visits", () => {
  const session = buildMinimalCompletedSession([
    { id: "u1", type: "user", name: "Levi" },
  ]);
  session.visitHistory = [
    {
      visitNumber: 1,
      playerId: "u1",
      visitScore: 180,
      remainingBefore: 501,
      remainingAfter: 321,
      bust: false,
      checkout: false,
      legNumber: 1,
      setNumber: 1,
      dartsThrown: 3,
      stateSnapshot: structuredClone(session.state),
    },
    {
      visitNumber: 2,
      playerId: "u1",
      visitScore: 321,
      remainingBefore: 321,
      remainingAfter: 0,
      bust: false,
      checkout: true,
      legNumber: 1,
      setNumber: 1,
      dartsThrown: 3,
      stateSnapshot: structuredClone(session.state),
    },
  ];

  expect(buildSummary(session).players[0].firstNineAverage).toBeNull();
});

it("returns null checkoutRate when no double attempts", () => {
  const session = buildMinimalCompletedSession([
    { id: "u1", type: "user", name: "Levi" },
  ]);
  session.visitHistory = [
    {
      visitNumber: 1,
      playerId: "u1",
      visitScore: 501,
      remainingBefore: 501,
      remainingAfter: 0,
      bust: false,
      checkout: true,
      legNumber: 1,
      setNumber: 1,
      dartsThrown: 3,
      stateSnapshot: structuredClone(session.state),
    },
  ];

  expect(buildSummary(session).players[0].checkoutRate).toBeNull();
});

it("returns null bestLegDarts and worstLegDarts when player won no legs", () => {
  const session = buildMinimalCompletedSession([
    { id: "u1", type: "user", name: "Levi" },
    { id: "g1", type: "guest", name: "Guest" },
  ]);
  session.visitHistory = [
    {
      visitNumber: 1,
      playerId: "u1",
      visitScore: 60,
      remainingBefore: 501,
      remainingAfter: 441,
      bust: false,
      checkout: false,
      legNumber: 1,
      setNumber: 1,
      dartsThrown: 3,
      stateSnapshot: structuredClone(session.state),
    },
    {
      visitNumber: 2,
      playerId: "g1",
      visitScore: 141,
      remainingBefore: 501,
      remainingAfter: 0,
      bust: false,
      checkout: true,
      legNumber: 1,
      setNumber: 1,
      dartsThrown: 3,
      stateSnapshot: structuredClone(session.state),
    },
  ];
  session.state.players[1].totalLegsWon = 1;

  const summary = buildSummary(session);

  expect(summary.players[0].bestLegDarts).toBeNull();
  expect(summary.players[0].worstLegDarts).toBeNull();
  expect(summary.players[1].bestLegDarts).toBe(3);
  expect(summary.players[1].worstLegDarts).toBe(3);
});

it("orders two-player summary as [user, opponent]", () => {
  const session = buildMinimalCompletedSession([
    { id: "u1", type: "user", name: "Levi" },
    { id: "b1", type: "dartbot", name: "DartBot", level: 5 },
  ]);
  session.visitHistory = [
    {
      visitNumber: 1,
      playerId: "b1",
      visitScore: 141,
      remainingBefore: 501,
      remainingAfter: 0,
      bust: false,
      checkout: true,
      legNumber: 1,
      setNumber: 1,
      dartsThrown: 3,
      stateSnapshot: structuredClone(session.state),
    },
  ];
  session.state.players[1].totalLegsWon = 1;

  const summary = buildSummary(session);

  expect(summary.players).toHaveLength(2);
  expect(summary.players[0].playerId).toBe("u1");
  expect(summary.players[1].playerId).toBe("b1");
  expect(summary.players[1].displayName).toBe("DartBot");
  expect(summary.players[1].isBot).toBe(true);
  expect(summary.winnerDisplayName).toBe("DartBot");
});

it("sets showSetsRow true when unit is sets", () => {
  const session = buildFiveOhOneSession({
    matchMode: "first-to",
    targetCount: 2,
    unit: "sets",
    players: [{ id: "u1", type: "user", name: "Levi" }],
  });
  session.state.status = "completed";
  session.state.phase = "summary";

  expect(buildSummary(session).showSetsRow).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- tests/lib/shared/games/501/summary.test.ts`  
Expected: FAIL — legacy shape / missing fields

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/lib/shared/games/501/summary.test.ts
git commit -m "test(501): add failing summary redesign coverage"
```

---

### Task 3: Rewrite `buildSummary`

**Files:**
- Modify: `app/src/lib/shared/games/501/summary.ts`

- [ ] **Step 1: Replace `buildSummary` implementation**

Replace the body of `summary.ts` (keep `buildMatchFormatLabel` and `buildWinnerDisplayName`). Full replacement:

```ts
import { getOpponentPlayer } from "./bot-helpers";
import { DARTS_PER_VISIT } from "./constants";
import type {
  FiveOhOnePlayer,
  FiveOhOnePlayerSummary,
  FiveOhOneSession,
  FiveOhOneSettings,
  FiveOhOneSummary,
  FiveOhOneVisitRecord,
} from "./types";

export type { FiveOhOneSummary } from "./types";

type PlayerScoringStats = {
  threeDartAverage: number;
  checkoutsMade: number;
  checkoutAttempts: number;
};

function toUnitLabel(unit: FiveOhOneSettings["unit"], count: number): string {
  if (count === 1) {
    return unit === "legs" ? "leg" : "set";
  }
  return unit;
}

function buildWinnerDisplayName(session: FiveOhOneSession): string {
  const user = session.settings.players.find((p) => p.type === "user");
  if (session.settings.players.length === 1) {
    return user?.name ?? "You";
  }

  const winningPlayerId = getWinningPlayerId(session);
  const winner = session.settings.players.find(
    (player) => player.id === winningPlayerId,
  );

  if (!winner) return "Match completed";
  if (winner.type === "dartbot") return "DartBot";
  return winner.name;
}

export function buildMatchFormatLabel(settings: FiveOhOneSettings): string {
  const unitLabel = toUnitLabel(settings.unit, settings.targetCount);
  if (settings.matchMode === "first-to") {
    return `First to ${settings.targetCount} ${unitLabel}`;
  }
  return `Best of ${settings.targetCount} ${unitLabel}`;
}

function getWinningPlayerId(session: FiveOhOneSession): string | undefined {
  return [...session.visitHistory]
    .reverse()
    .find((visit) => visit.checkout)?.playerId;
}

function getPlayerScoringStats(
  history: FiveOhOneVisitRecord[],
  playerId: string,
): PlayerScoringStats {
  const playerVisits = history.filter((visit) => visit.playerId === playerId);
  const dartsThrown = playerVisits.reduce((sum, v) => sum + v.dartsThrown, 0);
  const pointsScored = playerVisits.reduce((total, visit) => {
    const points = visit.remainingBefore - visit.remainingAfter;
    return total + (points > 0 ? points : 0);
  }, 0);
  const checkoutAttempts = playerVisits.reduce(
    (sum, visit) => sum + (visit.dartsOnDouble ?? 0),
    0,
  );
  const checkoutsMade = playerVisits.filter((visit) => visit.checkout).length;

  return {
    threeDartAverage:
      dartsThrown === 0 ? 0 : pointsScored / (dartsThrown / DARTS_PER_VISIT),
    checkoutsMade,
    checkoutAttempts,
  };
}

function computeFirstNineAverage(
  history: FiveOhOneVisitRecord[],
  playerId: string,
): number | null {
  const playerVisits = history.filter((visit) => visit.playerId === playerId);
  if (playerVisits.length < 3) return null;

  const firstThree = playerVisits.slice(0, 3);
  const dartsThrown = firstThree.reduce((sum, visit) => sum + visit.dartsThrown, 0);
  const pointsScored = firstThree.reduce((total, visit) => {
    const points = visit.remainingBefore - visit.remainingAfter;
    return total + (points > 0 ? points : 0);
  }, 0);

  if (dartsThrown === 0) return null;
  return pointsScored / (dartsThrown / DARTS_PER_VISIT);
}

function computeHighestFinish(
  playerVisits: FiveOhOneVisitRecord[],
): number | null {
  const checkoutVisits = playerVisits.filter((visit) => visit.checkout);
  if (checkoutVisits.length === 0) return null;
  return Math.max(...checkoutVisits.map((visit) => visit.remainingBefore));
}

function computeHighestScore(
  playerVisits: FiveOhOneVisitRecord[],
): number | null {
  if (playerVisits.length === 0) return null;
  return Math.max(...playerVisits.map((visit) => visit.visitScore));
}

function computeLegDartsForWonLegs(
  history: FiveOhOneVisitRecord[],
  playerId: string,
): number[] {
  const wonLegKeys = new Set<string>();
  for (const visit of history) {
    if (visit.checkout && visit.playerId === playerId) {
      wonLegKeys.add(`${visit.setNumber}-${visit.legNumber}`);
    }
  }

  const legDarts: number[] = [];
  for (const legKey of wonLegKeys) {
    const [setNumber, legNumber] = legKey.split("-").map(Number);
    const dartsInLeg = history
      .filter(
        (visit) =>
          visit.playerId === playerId &&
          visit.setNumber === setNumber &&
          visit.legNumber === legNumber,
      )
      .reduce((sum, visit) => sum + visit.dartsThrown, 0);
    legDarts.push(dartsInLeg);
  }

  return legDarts;
}

function buildPlayerSummary(
  session: FiveOhOneSession,
  player: FiveOhOnePlayer,
  winningPlayerId: string | undefined,
): FiveOhOnePlayerSummary {
  const playerVisits = session.visitHistory.filter(
    (visit) => visit.playerId === player.id,
  );
  const scoring = getPlayerScoringStats(session.visitHistory, player.id);
  const playerState = session.state.players.find(
    (state) => state.playerId === player.id,
  );
  const legDarts = computeLegDartsForWonLegs(session.visitHistory, player.id);

  return {
    playerId: player.id,
    displayName: player.type === "dartbot" ? "DartBot" : player.name,
    isBot: player.type === "dartbot",
    isGuest: player.type === "guest",
    isWinner: player.id === winningPlayerId,
    setsWon: playerState?.setsWon ?? 0,
    legsWon: playerState?.totalLegsWon ?? 0,
    threeDartAverage: scoring.threeDartAverage,
    firstNineAverage: computeFirstNineAverage(session.visitHistory, player.id),
    checkoutRate:
      scoring.checkoutAttempts === 0
        ? null
        : (scoring.checkoutsMade / scoring.checkoutAttempts) * 100,
    checkoutsMade: scoring.checkoutsMade,
    checkoutAttempts: scoring.checkoutAttempts,
    highestFinish: computeHighestFinish(playerVisits),
    highestScore: computeHighestScore(playerVisits),
    bestLegDarts: legDarts.length === 0 ? null : Math.min(...legDarts),
    worstLegDarts: legDarts.length === 0 ? null : Math.max(...legDarts),
  };
}

function getPlayersForSummary(session: FiveOhOneSession): FiveOhOnePlayer[] {
  if (session.settings.players.length === 1) {
    return session.settings.players;
  }

  const userPlayer = session.settings.players.find(
    (player) => player.type === "user",
  );
  if (!userPlayer) {
    return session.settings.players;
  }

  const opponent = getOpponentPlayer(session, userPlayer.id);
  return opponent ? [userPlayer, opponent] : [userPlayer];
}

/**
 * Builds 501 end-of-match summary values from session history and settings.
 */
export function buildSummary(session: FiveOhOneSession): FiveOhOneSummary {
  const winningPlayerId = getWinningPlayerId(session);
  const players = getPlayersForSummary(session).map((player) =>
    buildPlayerSummary(session, player, winningPlayerId),
  );

  return {
    winnerDisplayName: buildWinnerDisplayName(session),
    showSetsRow: session.settings.unit === "sets",
    players,
  };
}
```

- [ ] **Step 2: Remove legacy tests from `summary.test.ts`**

Delete or rewrite the five existing tests that assert `resultLabel`, `matchFormatLabel`, `userThreeDartAverage`, `guestThreeDartAverage`, etc. Keep the new tests from Task 2 plus one migrated dartsThrown test:

```ts
it("uses per-visit dartsThrown for threeDartAverage", () => {
  const session = buildMinimalCompletedSession([
    { id: "u1", type: "user", name: "Levi" },
  ]);
  session.visitHistory = [
    {
      visitNumber: 1,
      playerId: "u1",
      visitScore: 180,
      remainingBefore: 501,
      remainingAfter: 321,
      bust: false,
      checkout: false,
      legNumber: 1,
      setNumber: 1,
      dartsThrown: 3,
      stateSnapshot: structuredClone(session.state),
    },
    {
      visitNumber: 2,
      playerId: "u1",
      visitScore: 321,
      remainingBefore: 321,
      remainingAfter: 0,
      bust: false,
      checkout: true,
      legNumber: 1,
      setNumber: 1,
      dartsThrown: 2,
      stateSnapshot: structuredClone(session.state),
    },
  ];

  expect(buildSummary(session).players[0].threeDartAverage).toBeCloseTo(300.6);
});
```

- [ ] **Step 3: Run summary tests**

Run: `cd app && npm test -- tests/lib/shared/games/501/summary.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/games/501/summary.ts tests/lib/shared/games/501/summary.test.ts
git commit -m "feat(501): build per-player summary with extended stats"
```

---

### Task 4: Update `stats.ts` consumer

**Files:**
- Modify: `app/src/lib/shared/games/501/stats.ts`
- Test: `app/tests/lib/shared/games/501/stats.test.ts`

- [ ] **Step 1: Update `applyGameCompletionToStats`**

Replace summary field reads in `stats.ts`:

```ts
export function applyGameCompletionToStats(
  stats: Player501Stats,
  session: FiveOhOneSession,
): void {
  const summary = buildSummary(session);
  const user = session.settings.players.find((player) => player.type === "user");
  const userId = user?.id;
  const userSummary = summary.players[0];

  stats.gamesCompleted += 1;
  if (didUserWin(session)) {
    stats.gamesWon += 1;
  }

  if (userId) {
    stats.totalDartsThrown += session.visitHistory
      .filter((visit) => visit.playerId === userId)
      .reduce((sum, visit) => sum + visit.dartsThrown, 0);
  }

  if (userSummary) {
    stats.totalCheckouts += userSummary.checkoutsMade;
    if (userSummary.threeDartAverage > stats.bestMatchAverage) {
      stats.bestMatchAverage = userSummary.threeDartAverage;
    }
  }

  if (userId) {
    const bestLegAverage = getBestLegAverage(session, userId);
    if (bestLegAverage > stats.bestLegAverage) {
      stats.bestLegAverage = bestLegAverage;
    }
  }
}
```

- [ ] **Step 2: Run stats tests**

Run: `cd app && npm test -- tests/lib/shared/games/501/stats.test.ts`  
Expected: PASS (assertions unchanged — same numeric outcomes)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/games/501/stats.ts
git commit -m "refactor(501): read completion stats from players summary"
```

---

### Task 5: `SummaryComparisonStatRow` component

**Files:**
- Create: `app/src/components/games/SummaryComparisonStatRow.astro`

- [ ] **Step 1: Create component**

```astro
---
interface Props {
  label: string;
  leftExpr: string;
  rightExpr: string;
}

const { label, leftExpr, rightExpr } = Astro.props;
---

<div class="w-full font-mono text-sm grid grid-cols-5">
  <dd class="text-left font-bold" x-text={leftExpr}></dd>
  <dt class="text-center text-text-muted font-bold lowercase col-span-3">
    {label}
  </dt>
  <dd class="text-right font-bold" x-text={rightExpr}></dd>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/games/SummaryComparisonStatRow.astro
git commit -m "feat(ui): add SummaryComparisonStatRow component"
```

---

### Task 6: Extend `PlayerAvatar` + `SummaryMatchHeader`

**Files:**
- Modify: `app/src/components/games/PlayerAvatar.astro`
- Create: `app/src/components/games/SummaryMatchHeader.astro`

- [ ] **Step 1: Add optional `nameExpr` to `PlayerAvatar`**

```astro
---
interface Props {
  name?: string;
  nameExpr?: string;
  isBot: boolean;
  isGuest: boolean;
}

const { name = "You", nameExpr, isBot = false, isGuest = false } = Astro.props;
import ProfileIcon from "@icons/profile.svg";
import BotIcon from "@icons/bot.svg";
---

<div class="flex items-center flex-col gap-2">
  <div class="relative flex p-2 items-center justify-center rounded-full border border-border bg-surface-elevated text-text-muted">
    {isBot ? (
      <BotIcon class="size-8" aria-hidden="true" />
    ) : (
      <ProfileIcon class="size-8" aria-hidden="true" />
    )}
    <span
      class="text-center text-xs top-12 bg-surface-elevated border-border border left-1/2 -translate-x-1/2 -translate-y-1/2 font-medium text-slate-200 absolute px-1.5 py-0.5 rounded-full"
      {...(nameExpr ? { "x-text": nameExpr } : {})}
    >
      {nameExpr ? "" : name}
    </span>
  </div>
</div>
```

- [ ] **Step 2: Create `SummaryMatchHeader`**

Markup copied from `test.astro` lines 14–36; bind via props:

```astro
---
import PlayerAvatar from "./PlayerAvatar.astro";
import TrophyIcon from "@icons/trophy.svg";

interface Props {
  summaryModel?: string;
  leftIndex?: number;
  rightIndex?: number;
}

const {
  summaryModel = "summary",
  leftIndex = 0,
  rightIndex = 1,
} = Astro.props;

const left = `${summaryModel}?.players[${leftIndex}]`;
const right = `${summaryModel}?.players[${rightIndex}]`;
---

<div class="w-full grid grid-cols-3 border-b border-border pb-3">
  <div class="col-span-1 flex justify-start">
    <div class="flex flex-col items-center justify-start gap-6">
      <PlayerAvatar
        nameExpr={`${left}?.displayName ?? ''`}
        isBot={false}
        isGuest={false}
      />
      <TrophyIcon
        class="size-6 text-text-muted"
        x-show={`${left}?.isWinner`}
        x-cloak
      />
    </div>
  </div>
  <div class="col-span-1 flex flex-col gap-2 justify-center items-center">
    <div class="flex flex-col justify-center items-center">
      <h3 class="text-xs font-semibold uppercase text-text-muted font-mono">
        Winner
      </h3>
      <h2
        class="text-3xl font-bold font-mono text-accent uppercase"
        x-text={`${summaryModel}?.winnerDisplayName ?? 'Match Complete'`}
      >
      </h2>
    </div>
    <span class="text-text-muted text-lg font-mono font-bold">vs</span>
  </div>
  <div class="col-span-1 flex flex-col items-end gap-6">
    <div class="flex flex-col items-center justify-start gap-6">
      <PlayerAvatar
        nameExpr={`${right}?.displayName ?? ''`}
        isBot={false}
        isGuest={false}
      />
      <TrophyIcon
        class="size-6 text-text-muted"
        x-show={`${right}?.isWinner`}
        x-cloak
      />
    </div>
  </div>
</div>
```

**Note:** `PlayerAvatar` `isBot` is static in Astro — bot opponents still show profile icon unless you add `isBotExpr` similarly. For 501, dartbot uses `BotIcon` via a follow-up: add optional `isBotExpr` prop mirroring `nameExpr`, or inline icon toggle in `SummaryMatchHeader` with `x-show={`${left}?.isBot`}`. Prefer adding `isBotExpr?: string` to `PlayerAvatar`:

```astro
{isBotExpr ? (
  <>
    <BotIcon class="size-8" aria-hidden="true" x-show={isBotExpr} x-cloak />
    <ProfileIcon class="size-8" aria-hidden="true" x-show={`!(${isBotExpr})`} x-cloak />
  </>
) : isBot ? (
  <BotIcon class="size-8" aria-hidden="true" />
) : (
  <ProfileIcon class="size-8" aria-hidden="true" />
)}
```

Pass `isBotExpr={`${left}?.isBot`}` and `isBotExpr={`${right}?.isBot`}` from `SummaryMatchHeader`.

- [ ] **Step 3: Commit**

```bash
git add src/components/games/PlayerAvatar.astro src/components/games/SummaryMatchHeader.astro
git commit -m "feat(ui): add SummaryMatchHeader with dynamic PlayerAvatar"
```

---

### Task 7: `SummaryActions` component

**Files:**
- Create: `app/src/components/games/SummaryActions.astro`

- [ ] **Step 1: Create shared actions footer**

```astro
---
interface Props {
  variant: "back-play" | "yes-no";
  disabledModel?: string;
  noStyle?: "link" | "button";
  actionsGapClass?: string;
}

const {
  variant,
  disabledModel = variant === "back-play" ? "persisting" : "loading",
  noStyle = "link",
  actionsGapClass = variant === "back-play" ? "gap-6 mt-3" : "gap-3",
} = Astro.props;
---

{
  variant === "back-play" ? (
    <div class={`grid grid-cols-2 ${actionsGapClass}`}>
      <button
        type="button"
        class="btn-secondary btn-press font-medium flex items-center justify-center"
        @click="backToGames()"
      >
        Back
      </button>
      <button
        type="button"
        class="btn-primary btn-press"
        :disabled={disabledModel}
        @click="playAgain()"
      >
        Play again
      </button>
    </div>
  ) : (
    <>
      <h3 class="font-semibold text-lg col-span-2">
        Do you want to play again?
      </h3>
      <div class={`grid grid-cols-2 ${actionsGapClass}`}>
        {noStyle === "link" ? (
          <a
            href="/games"
            class="btn-secondary btn-press font-medium flex items-center justify-center"
            :class={disabledModel + " && 'pointer-events-none opacity-50'"}
          >
            <span>No</span>
          </a>
        ) : (
          <button
            type="button"
            class="btn-secondary btn-press"
            :disabled={disabledModel}
            @click="window.location.href='/games'"
          >
            No
          </button>
        )}
        <button
          type="button"
          class="btn-primary btn-press"
          :disabled={disabledModel}
          @click="playAgain()"
        >
          Yes
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/games/SummaryActions.astro
git commit -m "feat(ui): add shared SummaryActions component"
```

---

### Task 8: Alpine display helpers

**Files:**
- Modify: `app/src/lib/client/alpine/games/501.play.ts`

- [ ] **Step 1: Add format helpers to factory return object**

Inside `fiveOhOnePlay`, add methods after `matchFormatLabelDisplay`:

```ts
formatSummaryAverage(value: number | null | undefined) {
  return value == null ? "-" : value.toFixed(1);
},

formatSummaryCheckoutRate(value: number | null | undefined) {
  return value == null ? "-" : `${value.toFixed(2)}%`;
},

formatSummaryCheckouts(made: number | undefined, attempts: number | undefined) {
  return `${made ?? 0}/${attempts ?? 0}`;
},

formatSummaryInteger(value: number | null | undefined) {
  return value == null ? "-" : String(value);
},
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/client/alpine/games/501.play.ts
git commit -m "feat(501): add Alpine summary display formatters"
```

---

### Task 9: `MultiplayerSummary` component

**Files:**
- Create: `app/src/components/games/501/MultiplayerSummary.astro`

- [ ] **Step 1: Create two-player summary body**

```astro
---
import SummaryComparisonStatRow from "../SummaryComparisonStatRow.astro";
import SummaryMatchHeader from "../SummaryMatchHeader.astro";

interface Props {
  summaryModel?: string;
}

const { summaryModel = "summary" } = Astro.props;

const p0 = `${summaryModel}?.players[0]`;
const p1 = `${summaryModel}?.players[1]`;
---

<div class="flex flex-col gap-3">
  <SummaryMatchHeader summaryModel={summaryModel} />
  <dl class="flex flex-col gap-1">
    <div x-show={`${summaryModel}?.showSetsRow`} x-cloak>
      <SummaryComparisonStatRow
        label="Sets"
        leftExpr={`formatSummaryInteger(${p0}?.setsWon)`}
        rightExpr={`formatSummaryInteger(${p1}?.setsWon)`}
      />
    </div>
    <SummaryComparisonStatRow
      label="Legs"
      leftExpr={`formatSummaryInteger(${p0}?.legsWon)`}
      rightExpr={`formatSummaryInteger(${p1}?.legsWon)`}
    />
    <SummaryComparisonStatRow
      label="3-dart avg."
      leftExpr={`formatSummaryAverage(${p0}?.threeDartAverage)`}
      rightExpr={`formatSummaryAverage(${p1}?.threeDartAverage)`}
    />
    <SummaryComparisonStatRow
      label="first 9 avg."
      leftExpr={`formatSummaryAverage(${p0}?.firstNineAverage)`}
      rightExpr={`formatSummaryAverage(${p1}?.firstNineAverage)`}
    />
    <SummaryComparisonStatRow
      label="checkout rate"
      leftExpr={`formatSummaryCheckoutRate(${p0}?.checkoutRate)`}
      rightExpr={`formatSummaryCheckoutRate(${p1}?.checkoutRate)`}
    />
    <SummaryComparisonStatRow
      label="checkouts"
      leftExpr={`formatSummaryCheckouts(${p0}?.checkoutsMade, ${p0}?.checkoutAttempts)`}
      rightExpr={`formatSummaryCheckouts(${p1}?.checkoutsMade, ${p1}?.checkoutAttempts)`}
    />
    <SummaryComparisonStatRow
      label="Highest finish"
      leftExpr={`formatSummaryInteger(${p0}?.highestFinish)`}
      rightExpr={`formatSummaryInteger(${p1}?.highestFinish)`}
    />
    <SummaryComparisonStatRow
      label="Highest score"
      leftExpr={`formatSummaryInteger(${p0}?.highestScore)`}
      rightExpr={`formatSummaryInteger(${p1}?.highestScore)`}
    />
    <SummaryComparisonStatRow
      label="Best leg"
      leftExpr={`formatSummaryInteger(${p0}?.bestLegDarts)`}
      rightExpr={`formatSummaryInteger(${p1}?.bestLegDarts)`}
    />
    <SummaryComparisonStatRow
      label="worst leg"
      leftExpr={`formatSummaryInteger(${p0}?.worstLegDarts)`}
      rightExpr={`formatSummaryInteger(${p1}?.worstLegDarts)`}
    />
  </dl>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/games/501/MultiplayerSummary.astro
git commit -m "feat(501): add MultiplayerSummary component"
```

---

### Task 10: `SinglePlayerSummary` component

**Files:**
- Create: `app/src/components/games/501/SinglePlayerSummary.astro`

- [ ] **Step 1: Create single-player summary body**

```astro
---
import SummaryStatRow from "../SummaryStatRow.astro";

interface Props {
  summaryModel?: string;
}

const { summaryModel = "summary" } = Astro.props;

const p0 = `${summaryModel}?.players[0]`;
---

<div class="flex flex-col gap-6">
  <div class="flex flex-col gap-2 justify-center items-center">
    <h3 class="text-lg font-semibold uppercase text-text-muted">Winner!</h3>
    <h2
      class="text-2xl font-bold font-mono text-accent"
      x-text={`${summaryModel}?.winnerDisplayName ?? 'Match Complete'`}
    ></h2>
  </div>
  <dl class="flex flex-col gap-1">
    <div x-show={`${summaryModel}?.showSetsRow`} x-cloak>
      <SummaryStatRow
        label="Sets"
        value={`formatSummaryInteger(${p0}?.setsWon)`}
      />
    </div>
    <SummaryStatRow
      label="Legs"
      value={`formatSummaryInteger(${p0}?.legsWon)`}
    />
    <SummaryStatRow
      label="3-dart avg."
      value={`formatSummaryAverage(${p0}?.threeDartAverage)`}
    />
    <SummaryStatRow
      label="first 9 avg."
      value={`formatSummaryAverage(${p0}?.firstNineAverage)`}
    />
    <SummaryStatRow
      label="checkout rate"
      value={`formatSummaryCheckoutRate(${p0}?.checkoutRate)`}
    />
    <SummaryStatRow
      label="checkouts"
      value={`formatSummaryCheckouts(${p0}?.checkoutsMade, ${p0}?.checkoutAttempts)`}
    />
    <SummaryStatRow
      label="Highest finish"
      value={`formatSummaryInteger(${p0}?.highestFinish)`}
    />
    <SummaryStatRow
      label="Highest score"
      value={`formatSummaryInteger(${p0}?.highestScore)`}
    />
    <SummaryStatRow
      label="Best leg"
      value={`formatSummaryInteger(${p0}?.bestLegDarts)`}
    />
    <SummaryStatRow
      label="worst leg"
      value={`formatSummaryInteger(${p0}?.worstLegDarts)`}
    />
  </dl>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/games/501/SinglePlayerSummary.astro
git commit -m "feat(501): add SinglePlayerSummary component"
```

---

### Task 11: Slim `501/Summary.astro` orchestrator

**Files:**
- Modify: `app/src/components/games/501/Summary.astro`

- [ ] **Step 1: Replace with thin branch + actions**

```astro
---
import MultiplayerSummary from "./MultiplayerSummary.astro";
import SinglePlayerSummary from "./SinglePlayerSummary.astro";
import SummaryActions from "../SummaryActions.astro";

interface Props {
  showSummaryModel?: string;
  summaryModel?: string;
}

const {
  showSummaryModel = "showSummary && summary",
  summaryModel = "summary",
} = Astro.props;
---

<article class="game-panel p-6 flex flex-col gap-3" x-show={showSummaryModel} x-cloak>
  <template x-if={`${summaryModel}?.players?.length === 2`}>
    <MultiplayerSummary summaryModel={summaryModel} />
  </template>

  <template x-if={`${summaryModel}?.players?.length === 1`}>
    <SinglePlayerSummary summaryModel={summaryModel} />
  </template>

  <SummaryActions variant="back-play" />
</article>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/games/501/Summary.astro
git commit -m "feat(501): wire summary orchestrator to 1P/2P components"
```

---

### Task 12: Roll `SummaryActions` into other games

**Files:**
- Modify: `app/src/components/games/score-training/Summary.astro`
- Modify: `app/src/components/games/singles-training/Summary.astro`
- Modify: `app/src/components/games/ten-up-one-down/Summary.astro`

- [ ] **Step 1: score-training — replace footer**

Remove the `<div class="grid grid-cols-2 gap-3">` block and prompt; add:

```astro
import SummaryActions from "../SummaryActions.astro";
```

Before closing `</article>`:

```astro
<SummaryActions variant="yes-no" disabledModel={loadingModel} />
```

- [ ] **Step 2: singles-training — same pattern with `gap-2`**

```astro
<SummaryActions
  variant="yes-no"
  disabledModel={loadingModel}
  actionsGapClass="gap-2"
/>
```

Remove existing footer markup.

- [ ] **Step 3: ten-up-one-down — button-style No**

Remove `<h3>` and footer `<div>`; add:

```astro
import SummaryActions from "../SummaryActions.astro";
```

```astro
<SummaryActions
  variant="yes-no"
  disabledModel={loadingModel}
  noStyle="button"
  actionsGapClass="gap-2"
/>
```

Keep the article `gap-4` and header unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/games/score-training/Summary.astro \
  src/components/games/singles-training/Summary.astro \
  src/components/games/ten-up-one-down/Summary.astro
git commit -m "refactor: adopt SummaryActions in training game summaries"
```

---

### Task 13: API + curl tests

**Files:**
- Modify: `app/tests/api/games/501/complete.test.ts`
- Modify: `app/scripts/curl-verify-501.sh`

- [ ] **Step 1: Update complete API test expected summary**

Replace the `expect(data.summary).toEqual({...})` block in the "saves stats" test:

```ts
expect(data.summary).toEqual({
  winnerDisplayName: "Levi",
  showSetsRow: false,
  players: [
    expect.objectContaining({
      playerId: "u1",
      displayName: "Levi",
      isWinner: true,
      legsWon: 1,
      threeDartAverage: 167,
      checkoutsMade: 1,
    }),
  ],
});
```

- [ ] **Step 2: Update curl script assertion**

In `scripts/curl-verify-501.sh`, change line 53:

```bash
assert_contains "$COMPLETE_RESP" '"players"' "complete returns summary"
```

- [ ] **Step 3: Run API test**

Run: `cd app && npm test -- tests/api/games/501/complete.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/api/games/501/complete.test.ts scripts/curl-verify-501.sh
git commit -m "test(501): update completion summary shape expectations"
```

---

### Task 14: Assembly tests

**Files:**
- Modify: `app/tests/pages/501-play-assembly.test.ts`
- Modify: `app/tests/pages/score-training-play-assembly.test.ts`
- Modify: `app/tests/pages/singles-training-play-assembly.test.ts`
- Modify: `app/tests/pages/ten-up-one-down-play-assembly.test.ts`

- [ ] **Step 1: Extend 501 assembly test**

Add to `501-play-assembly.test.ts`:

```ts
it("Summary.astro delegates to 1P/2P subcomponents", () => {
  const source = readSource("src/components/games/501/Summary.astro");
  expect(source).toContain("MultiplayerSummary");
  expect(source).toContain("SinglePlayerSummary");
  expect(source).toContain("SummaryActions");
  expect(source).toContain("players?.length === 2");
  expect(source).toContain("players?.length === 1");
});

it("MultiplayerSummary uses head-to-head components", () => {
  const source = readSource("src/components/games/501/MultiplayerSummary.astro");
  expect(source).toContain("SummaryMatchHeader");
  expect(source).toContain("SummaryComparisonStatRow");
  expect(source).toContain("formatSummaryAverage");
});

it("SinglePlayerSummary uses stat rows without legacy fields", () => {
  const source = readSource("src/components/games/501/SinglePlayerSummary.astro");
  expect(source).toContain("SummaryStatRow");
  expect(source).toContain("formatSummaryAverage");
  expect(source).not.toContain("resultLabel");
  expect(source).not.toContain("userThreeDartAverage");
});
```

- [ ] **Step 2: Add SummaryActions checks to other game assembly tests**

For each of score-training, singles-training, ten-up-one-down assembly test files, add:

```ts
it("Summary.astro uses shared SummaryActions", () => {
  const source = readSource("src/components/games/<slug>/Summary.astro");
  expect(source).toContain("SummaryActions");
  expect(source).toContain('variant="yes-no"');
});
```

- [ ] **Step 3: Run assembly tests**

Run: `cd app && npm test -- tests/pages/`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/pages/
git commit -m "test: assembly coverage for summary redesign components"
```

---

### Task 15: Full verification

- [ ] **Step 1: Run static gate**

```bash
cd app && npm run check && npm test && npx fallow && npm run lint && ./scripts/audit-imports.sh
```

Expected: all pass

- [ ] **Step 2: Run curl smoke (dev server required)**

```bash
cd app && ./scripts/curl-verify-501.sh
```

Expected: `All curl checks passed`

- [ ] **Step 3: Final commit if any fixups needed**

---

## Self-Review

| Spec requirement | Task |
| ---------------- | ---- |
| `FiveOhOnePlayerSummary` + `FiveOhOneSummary` types | Task 1 |
| All stat computations + null edge cases | Tasks 2–3 |
| `stats.ts` reads `players[0]` | Task 4 |
| `SummaryComparisonStatRow` markup from test.astro | Task 5 |
| `SummaryMatchHeader` 3-col + trophy | Task 6 |
| `SummaryActions` back-play + yes-no | Task 7 |
| 501 1P/2P layout bodies | Tasks 9–10 |
| 501 orchestrator | Task 11 |
| Alpine null → `-` formatting | Task 8 |
| Cross-game `SummaryActions` rollout | Task 12 |
| `summary.test.ts` coverage | Tasks 2–3 |
| `complete.test.ts` + curl | Task 13 |
| Assembly tests | Task 14 |
| `test.astro` cleanup | Out of scope per spec |

**Placeholder scan:** None — all steps include concrete code/commands.

**Type consistency:** `players[0]`/`players[1]`, formatter method names, and prop names are consistent across Tasks 8–9.
