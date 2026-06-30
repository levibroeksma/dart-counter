# 501 Summary Redesign — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-30
**Scope:** Restructure `FiveOhOneSummary` data for head-to-head stats, implement two-player summary UI from `test.astro`, update single-player summary stats, extract reusable summary components, roll shared components into all game summaries.

**UI reference:** `app/src/pages/test.astro` (two-player layout — styling is canonical; do not change classes)

---

## 1. Overview

The 501 end-of-match summary needs richer per-player statistics and a head-to-head layout for two-player matches. Single-player matches keep the existing centered layout but display the same stat set as single values.

Shared summary UI primitives (`SummaryActions`, head-to-head row/header components) are extracted so all released game summaries use the same building blocks where applicable.

| Item               | Value                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Two-player UI      | 3-column header (avatars + winner) + 5-column comparison stat grid — exact markup from `test.astro` |
| Single-player UI   | Centered winner header + `SummaryStatRow` list (existing layout pattern)                            |
| Data approach      | Player-array summary (`FiveOhOneSummary.players`)                                                   |
| Null display       | API returns `null`; Alpine `x-text` renders `-` in UI                                               |
| Cross-game rollout | `SummaryActions` in all four game summaries; head-to-head components 501-only for now               |

---

## 2. Decisions log (brainstorming)

| Topic                 | Decision                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Single-player stats   | All reference stat rows, one value each (no left/right columns)                                 |
| First 9 avg           | Match-wide: first 3 visits only; `< 3` visits → `null`                                          |
| Best / worst leg      | Fewest / most darts to finish a leg; no leg won → `null`                                        |
| Trophy                | Winner's side only                                                                              |
| Sets row              | Show only when `settings.unit === "sets"`                                                       |
| Checkout rate         | `(checkouts / dartsOnDouble) × 100`, display `50.00%` (2 decimals); no attempts → `null`        |
| Checkouts row         | Fraction `finishes/attempts` e.g. `1/2`                                                         |
| Highest finish        | Max `remainingBefore` on checkout visit; none → `null`                                          |
| Highest score         | Max `visitScore`; none → `null`                                                                 |
| Null → hyphen         | UI responsibility (Alpine), not `buildSummary`                                                  |
| Data model            | Approach 2: `players[]` array, ordered `[user, opponent]` for 2P                                |
| Legacy summary fields | Remove (`resultLabel`, `matchFormatLabel`, `userThreeDartAverage`, guest-prefixed fields, etc.) |
| Other games           | Adopt `SummaryActions`; keep game-specific stat rows and headers                                |

---

## 3. Data model

### `FiveOhOnePlayerSummary`

```ts
type FiveOhOnePlayerSummary = {
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
```

### `FiveOhOneSummary`

```ts
type FiveOhOneSummary = {
  winnerDisplayName: string;
  showSetsRow: boolean;
  players: FiveOhOnePlayerSummary[];
};
```

- `players.length` is `1` or `2`.
- Two-player order: index `0` = user (left), index `1` = opponent (right).
- `showSetsRow` = `settings.unit === "sets"`.

---

## 4. Stat computation (`buildSummary`)

All stats derived from `visitHistory` and final `state.players` at completion.

| Stat                                 | Computation                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `setsWon` / `legsWon`                | `state.players` fields (`setsWon`, `totalLegsWon`)                                                             |
| `isWinner`                           | Player ID of last checkout visit in history                                                                    |
| `displayName`                        | User/guest name; dartbot always `"DartBot"`                                                                    |
| `threeDartAverage`                   | Existing points-scored / darts logic (`getPlayerSummaryStats`)                                                 |
| `firstNineAverage`                   | First 3 visits for player in match; points / (darts/3); `< 3` visits → `null`                                  |
| `checkoutRate`                       | `checkouts / sum(dartsOnDouble)`; no attempts → `null`                                                         |
| `checkoutsMade` / `checkoutAttempts` | Checkout count / total `dartsOnDouble`                                                                         |
| `highestFinish`                      | Max `remainingBefore` where `checkout === true`; none → `null`                                                 |
| `highestScore`                       | Max `visitScore`; none → `null`                                                                                |
| `bestLegDarts` / `worstLegDarts`     | Per completed leg: sum `dartsThrown` for that player in leg; min/max across legs they won; no leg won → `null` |

### Downstream consumers

| Consumer           | Change                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| `stats.ts`         | Read `players[0]` for `totalDartsThrown`, `totalCheckouts`, `bestMatchAverage` |
| `complete` API     | Returns new summary shape (no breaking external clients)                       |
| Alpine 501 factory | Bind to `summary.players[n]` fields                                            |

---

## 5. UI components

```
components/games/
├── SummaryStatRow.astro              # existing — single-column label/value
├── SummaryComparisonStatRow.astro    # NEW — 5-col grid from test.astro
├── SummaryMatchHeader.astro          # NEW — 3-col avatar / winner / vs
├── SummaryActions.astro              # NEW — shared footer buttons
└── 501/Summary.astro                 # orchestrator
```

### `SummaryComparisonStatRow`

Props: `label`, `leftExpr`, `rightExpr` (Alpine expression strings).

Markup (unchanged from `test.astro`):

```html
<div class="w-full font-mono text-sm grid grid-cols-5">
  <dd class="text-left font-bold" x-text="{leftExpr}"></dd>
  <dt class="text-center text-text-muted font-bold lowercase col-span-3">
    {label}
  </dt>
  <dd class="text-right font-bold" x-text="{rightExpr}"></dd>
</div>
```

### `SummaryMatchHeader`

Props: Alpine expression strings for left/right player (`name`, `isBot`, `isGuest`, `isWinner`) and `winnerDisplayName`.

- Left column: `justify-start`; right: `items-end`.
- Trophy: `x-show` winner flag on each side; winner side only visible.
- Center: "Winner" label + name + "vs" span.
- Uses `PlayerAvatar` + `TrophyIcon`.

### `SummaryActions`

Props:

| Prop            | Type         | Default                                              |
| --------------- | ------------ | ---------------------------------------------------- | -------- |
| `variant`       | `'back-play' | 'yes-no'`                                            | required |
| `disabledModel` | string       | `'persisting'` for back-play; `'loading'` for yes-no |

`back-play` (501): `Back` + `Play again` — `grid-cols-2 gap-6 mt-3`, `@click="backToGames()"` / `@click="playAgain()"`.

`yes-no` (score-training, singles-training, ten-up-one-down): prompt + `No` link (`/games`) + `Yes` button — preserve each game's existing gap/prompt markup.

### `501/Summary.astro`

```
if players.length === 2:
  SummaryMatchHeader
  dl:
    SummaryComparisonStatRow (Sets)     x-show showSetsRow
    SummaryComparisonStatRow × 9 more
  SummaryActions variant=back-play

if players.length === 1:
  centered winner header (existing pattern)
  dl:
    SummaryStatRow × 10 (conditional Sets row)
  SummaryActions variant=back-play
```

### Alpine display helpers

Register in 501 Alpine factory (or inline `x-text`):

```js
// null → '-'
v == null ? "-" : v.toFixed(1); // averages
v == null
  ? "-"
  : v.toFixed(2) +
    "%" // checkout rate
    `${made}/${attempts}`; // checkouts fraction
v == null ? "-" : String(v); // integers (best/worst leg, highest finish/score)
```

---

## 6. Cross-game summary rollout

| Game             | Header               | Stats                        | Actions                      |
| ---------------- | -------------------- | ---------------------------- | ---------------------------- |
| 501 (2P)         | `SummaryMatchHeader` | `SummaryComparisonStatRow`   | `SummaryActions` `back-play` |
| 501 (1P)         | inline centered      | `SummaryStatRow`             | `SummaryActions` `back-play` |
| score-training   | inline (unchanged)   | `SummaryStatRow` (unchanged) | `SummaryActions` `yes-no`    |
| singles-training | inline (unchanged)   | `SummaryStatRow` (unchanged) | `SummaryActions` `yes-no`    |
| ten-up-one-down  | inline (unchanged)   | `SummaryStatRow` (unchanged) | `SummaryActions` `yes-no`    |

`SummaryMatchHeader` and `SummaryComparisonStatRow` remain available for future multiplayer games; only 501 uses them in this scope.

---

## 7. Stat rows (both layouts)

| Label          | Single-player source | Two-player left / right                   |
| -------------- | -------------------- | ----------------------------------------- |
| Sets           | `players[0].setsWon` | `players[0]` / `players[1]` — conditional |
| Legs           | `players[0].legsWon` | `players[0]` / `players[1]`               |
| 3-dart avg.    | `threeDartAverage`   | both players                              |
| first 9 avg.   | `firstNineAverage`   | both players                              |
| checkout rate  | `checkoutRate`       | both players                              |
| checkouts      | `made/attempts`      | both players                              |
| Highest finish | `highestFinish`      | both players                              |
| Highest score  | `highestScore`       | both players                              |
| Best leg       | `bestLegDarts`       | both players                              |
| worst leg      | `worstLegDarts`      | both players                              |

---

## 8. Testing

| Layer                | Coverage                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `summary.test.ts`    | All new stats; null edge cases (first 9, checkout rate, best/worst leg, highest finish/score); 1P and 2P shapes; dartbot opponent |
| `complete.test.ts`   | Updated expected summary JSON                                                                                                     |
| `stats.test.ts`      | Reads from `players[0]` if applicable                                                                                             |
| Assembly tests       | 501 + other games import `SummaryActions`; 501 two-player wiring strings                                                          |
| `curl-verify-501.sh` | Summary still renders after completion                                                                                            |

---

## 9. Out of scope

- Changing play-screen UI
- Multiplayer summary for non-501 games
- Formatting null as `"-"` in shared/API layer
- `test.astro` page cleanup (optional follow-up)
