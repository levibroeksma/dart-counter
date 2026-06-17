# Score Training — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-17  
**Branch:** TBD  
**Scope:** Settings form, typed settings, game session model, play UI (number pad + score display), round tracking, end-of-game summary, global player stats, undo — for the `score-training` game mode

**UI reference:** `app/src/components/games/ten-up-one-down/Play.astro`, `app/src/components/ui/NumberInputPad.astro`

---

## 1. Overview

Define the data model and requirements for **Score Training** so a game can be configured, started, played (one score submission per visit), and tracked for progress and lifetime statistics.

**Game summary:**

| Rule | Value |
|---|---|
| Players | 1 |
| Darts per visit | 3 |
| Starting score | 0 |
| Per visit | Enter 3-dart score (0–180) |
| Current score | Running total of visit scores |
| Submit | Simple — no modal |
| Undo | Unlimited consecutive (revert last visit) |
| Default end | 10 rounds |
| Alt end | Timed: 5–30 min (UI in minutes, stored as seconds), default 10 min |
| Timed visits | Unlimited until timer = 0 |

**User flow:**

1. `/games/settings-score-training` — configure end mode (rounds or timed); form always shows defaults
2. If in-progress session exists → prompt: resume or abandon & start new
3. Start → create game session (settings + initial state) → `/games/score-training`
4. Play — enter visit score on number pad; Submit persists round
5. Optional undo last submitted round (unlimited consecutive)
6. Game ends → summary screen → session deleted; global stats updated

| Item | Value |
|---|---|
| Stack | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript |
| Storage | Netlify Blobs via data layer |
| Settings persistence | Active game session only |
| Stats persistence | Global per player (`PlayerScoreTrainingStats`) |
| Round entry UX | `NumberInputPad` — no confirmation modal |

---

## 2. Settings form requirements

### User-configurable fields

| Field | Type | When | Default | Validation |
|---|---|---|---|---|
| `endMode` | `"rounds" \| "timed"` | always | `"rounds"` | required |
| `roundCount` | number | `endMode === "rounds"` | `10` | integer 1–100 |
| `playtimeMinutes` | number (form only) | `endMode === "timed"` | `10` | integer 5–30 |

Client converts `playtimeMinutes` → `playtimeSeconds` (`minutes × 60`) before POST. Server validates `playtimeSeconds` integer 300–1800.

### Engine constants

| Constant | Value |
|---|---|
| `dartsPerVisit` | `3` |
| `playerCount` | `1` |
| `startingScore` | `0` |
| `minVisitScore` | `0` |
| `maxVisitScore` | `180` |

### Settings type

```ts
type ScoreTrainingSettings =
  | { endMode: "rounds"; roundCount: number }
  | { endMode: "timed"; playtimeSeconds: number };
```

### In-progress session on settings page

When an active session exists:

- Show banner: *"Game in progress"*
- **Resume** → navigate to play page
- **Abandon & start new** → delete session, show fresh form with defaults

---

## 3. Architecture & data flow

```
SettingsForm (defaults)
  → validateScoreTrainingSettings(raw)
  → ScoreTrainingSettings
  → POST create session
      → server: createInitialGameState(settings)
      → persist ScoreTrainingSession
  → redirect /games/score-training

Play page
  → load active session (no session → redirect to settings)
  → render from session.state + session.roundHistory

Round submit
  → buildRoundRecord(visitScore) on client
  → POST session/round { round, timeRemainingSeconds?, timerExpired? }
      → validate visit score
      → append roundHistory, update currentScore / lastScore
      → if completed: apply global stats, delete session, return summary
      → else persist session

Timer expiry (no score in progress)
  → POST session/complete { timeRemainingSeconds: 0 }
      → apply global stats, delete session, return summary

Undo last round
  → DELETE session/round/last
      → revert state + roundHistory (no global stats change)
      → persist session
```

### Blob stores

| Store | Key pattern | Contents |
|---|---|---|
| `game-sessions` | `{userId}:score-training` | Active `ScoreTrainingSession` |
| `player-score-training-stats` | `{userId}` | `PlayerScoreTrainingStats` |

---

## 4. File structure

```
app/src/lib/shared/games/score-training/
  constants.ts
  settings.ts
  session.ts
  validation.ts
  round.ts
  state.ts
  summary.ts
  stats.ts

app/src/lib/server/data/
  score-training-session.ts
  player-score-training-stats.ts

app/src/pages/api/games/score-training/
  session.ts
  session/round.ts
  session/round/last.ts
  session/complete.ts

app/src/lib/client/alpine/games/
  score-training.settings.ts
  score-training.play.ts

app/src/components/games/score-training/
  SettingsForm.astro
  ScoreTrainingSettingsShell.astro
  Play.astro
  ScoreCard.astro
  ProgressBar.astro
  Summary.astro
```

---

## 5. Session & state types

```ts
type ScoreTrainingGameStatus = "active" | "paused" | "completed";

type ScoreTrainingGameState = {
  currentRound: number;       // next visit number (1-based)
  currentScore: number;       // running total
  status: ScoreTrainingGameStatus;
  lastScore: number | null;
};

type ScoreTrainingSession = {
  slug: "score-training";
  settings: ScoreTrainingSettings;
  state: ScoreTrainingGameState;
  roundHistory: ScoreTrainingRoundRecord[];
  timeRemainingSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

type ScoreTrainingRoundRecord = {
  roundNumber: number;
  visitScore: number;         // 0–180
  runningTotal: number;
};
```

### Derived values (computed, not stored)

- `dartsThrown = roundHistory.length × 3`
- `threeDartAverage = roundHistory.length > 0 ? currentScore / roundHistory.length : 0`

---

## 6. Play UI

### Layout

```
[Leave]  Score Training  [spacer]
┌─ ProgressBar ─────────────────────────┐
│ Rounds: "Round N of M"                │  OR  Timed: "MM:SS" + Pause
└───────────────────────────────────────┘
┌─ ScoreCard ───────────────────────────┐
│           CURRENT SCORE               │
│              {currentScore}           │
│  3-dart avg | Darts thrown | Last     │
└───────────────────────────────────────┘
┌─ NumberInputPad ──────────────────────┘
```

- **ProgressBar:** rounds mode shows round counter only; timed mode shows countdown only (no round number) + pause/resume
- **ScoreCard:** TUOD `TargetCard` layout — large score, stats row below
- **NumberInputPad:** reused as-is

### Timer behavior

- Countdown ticks every 1s when `status === "active"` AND `score === null`
- Auto-pause while entering score (`score !== null`)
- Manual pause/resume button in timed mode
- Timer expiry with score in progress: player may finish visit; game ends on next submit
- Timer expiry with no score in progress: `POST session/complete` → summary

### Leave

Confirmation modal (same pattern as TUOD). Navigating away abandons session; no stats update.

---

## 7. End-of-game summary

Rendered after completion (round POST or complete POST returns `summary`).

| Field | Source |
|---|---|
| Total score | `state.currentScore` |
| 3-dart average | `currentScore / roundHistory.length` (0 if no rounds) |
| Rounds played | `roundHistory.length` |
| Darts thrown | `roundHistory.length × 3` |

"Back to games" button → `/games`

---

## 8. Global stats

```ts
type PlayerScoreTrainingStats = {
  gamesCompleted: number;
  totalDartsThrown: number;
  totalPointsScored: number;
  bestVisitScore: number;
  bestGameAverage: number;
};
```

Updated **once on game completion** (not per round). Undo during active game does not affect global stats. Abandon/leave does not affect global stats.

On completion:

- `gamesCompleted += 1`
- `totalDartsThrown += roundHistory.length × 3`
- `totalPointsScored += currentScore`
- `bestVisitScore = max(bestVisitScore, max visit scores this game)`
- `bestGameAverage = max(bestGameAverage, game 3-dart average)`

---

## 9. Validation & errors

| Input | Rule | Code |
|---|---|---|
| Visit score | Integer 0–180 | `INVALID_SCORE` |
| Round count | Integer 1–100 | `INVALID_GAME_SETTINGS` |
| Playtime | Integer 300–1800 seconds | `INVALID_GAME_SETTINGS` |
| Round POST | Active session | `NO_ACTIVE_SESSION` |
| Round POST | Not already completed | `GAME_COMPLETED` |
| Undo | `roundHistory.length > 0` | `NO_ROUNDS_TO_UNDO` |
| Create session | No existing session | `SESSION_EXISTS` |

### API response shapes

```ts
type ScoreTrainingSummary = {
  totalScore: number;
  threeDartAverage: number;
  roundsPlayed: number;
  dartsThrown: number;
};

type ScoreTrainingSessionSuccess = {
  ok: true;
  session: ScoreTrainingSession;
  completed?: boolean;
  summary?: ScoreTrainingSummary;
};
```

---

## 10. Registration touchpoints

- `SEED_GAMES`: `{ slug: "score-training", displayName: "Score Training", sortOrder: 4, enabled: true }`
- `components.ts` registry
- `[game].astro` session load + redirect guard
- `settings-[game].astro` active session check
- `app.factory.ts` Alpine registrations
- `errors.constants.ts`: `INVALID_SCORE`, `GAME_COMPLETED`, `NO_ROUNDS_TO_UNDO`

---

## 11. Testing

| Layer | Files |
|---|---|
| Constants | `constants.test.ts` |
| Validation | `validation.test.ts` |
| State | `state.test.ts` |
| Round | `round.test.ts` |
| Summary | `summary.test.ts` |
| Stats | `stats.test.ts` |
| Session data | `score-training-session.test.ts` |
| API session | `session.test.ts` |
| API round | `round.test.ts` |
| API undo | `round-last.test.ts` |
| API complete | `complete.test.ts` |
| Alpine settings | `score-training.settings.test.ts` |
| Alpine play | `score-training.play.test.ts` |

---

## 12. Out of scope

- Per-round global stats updates (stats on completion only)
- Multi-player
- Settings remembered across games
- Checkout / double tracking modals
- Round-by-round history on summary screen
