# Singles Training — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-17  
**Branch:** TBD  
**Scope:** Settings form, typed settings, per-dart session model, custom dart input UI, target sequence (21 targets), mode-based failure (dead), end-of-game summary with play-again prompt, global player stats, per-dart undo — for the `singles-training` game mode

**UI reference:** `app/src/pages/test.astro` (play layout mockup), `app/src/components/games/score-training/` (session/settings patterns)

---

## 1. Overview

**Singles Training** is a single-player accuracy exercise. The player throws 3 darts at each of 21 targets (numbers 1–20 plus Bull), records each dart individually, and accumulates score and segment statistics.

| Rule | Value |
|---|---|
| Players | 1 |
| Targets per game | 21 (1–20 + Bull) |
| Darts per target | 3 (auto-advance after dart 3 if still alive) |
| Starting score | 0 |
| Input | Per-dart: S/D/T (numbers) or Single/Bull (bull target), Miss, undo (≤) |
| Undo | One dart at a time (unlimited consecutive) |
| Manual leave | No lifetime stats saved |

### Modes

| Mode | Rule |
|---|---|
| Normal | 3 darts per target; advance regardless of hits |
| Hard | After dart 3: ≥1 hit on target required or **dead** (game over) |
| Extreme | After dart 3: ≥2 hits on target required or **dead** |

**Dead** = immediate game over. Show end screen with stats to that point.

**Complete** = all 21 targets cleared. Show end screen with full stats.

### Settings

| Setting | Options |
|---|---|
| Direction | `low-to-high` (1…20, Bull), `high-to-low` (Bull, 20…1), `random` (all 21 shuffled once at session start) |
| Mode | `normal`, `hard`, `extreme` |
| Scoring | `traditional` (S=1, D=2, T=3; bull outer=1, inner=2), `uniform` (any hit=1 pt) |

### Scoring

| Segment | Traditional points | Uniform points |
|---|---|---|
| Miss | 0 | 0 |
| Single (S{n} or outer bull) | 1 | 1 |
| Double (D{n} or inner bull) | 2 | 1 |
| Triple (T{n}) | 3 | 1 |

**Hit** = any non-miss outcome on the current target.

### User flow

1. `/games/settings-singles-training` — configure direction, mode, scoring
2. If in-progress session exists → prompt: resume or abandon & start new
3. Start → create session (settings + shuffled/fixed target sequence + initial state) → `/games/singles-training`
4. Play — tap dart outcome; auto-advance target after 3 darts (if alive)
5. Undo last dart via `<=` button
6. Game ends (complete or dead) → summary screen with play-again prompt
7. **Yes** → new session, same settings, re-shuffle if random
8. **No** → `/games`
9. Manual leave → confirmation modal; no stats update

| Item | Value |
|---|---|
| Slug | `singles-training` |
| Code | `st` |
| Stack | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript |
| Storage | Netlify Blobs via data layer |
| Stats persistence | Global per player on complete/dead only |

---

## 2. Architecture & data flow

**Approach:** Per-dart API (one POST per dart selection). Server is authoritative; undo DELETEs last dart.

```
SettingsForm
  → validateSinglesTrainingSettings(raw)
  → SinglesTrainingSettings
  → POST /api/games/singles-training/session
      → buildTargetSequence(direction)
      → createInitialGameState()
      → persist SinglesTrainingSession
  → redirect /games/singles-training

Play page
  → load active session (no session → redirect to settings)
  → render from session.state + session.dartHistory + current target

Dart submit
  → POST session/dart { outcome }
      → validate outcome matches current target
      → append dartHistory, update score + segmentCounts
      → if dart 3 on target: check mode minimum hits → dead or advance
      → if target 21 cleared → completed
      → if dead/completed: apply global stats, delete session, return summary
      → else persist session

Undo last dart
  → DELETE session/dart/last
      → pop dartHistory, recalc aggregates, revert indices
      → if was dead/completed → revert to active
      → persist session

Play again
  → POST session/play-again
      → create new session from previous settings (re-shuffle if random)
      → return new session
```

### Blob stores

| Store | Key pattern | Contents |
|---|---|---|
| `game-sessions` | `{userId}:singles-training` | Active `SinglesTrainingSession` |
| `player-singles-training-stats` | `{userId}` | `PlayerSinglesTrainingStats` |

---

## 3. File structure

```
app/src/lib/shared/games/singles-training/
  constants.ts
  settings.ts
  session.ts
  target-sequence.ts
  dart.ts
  state.ts
  summary.ts
  stats.ts
  validation.ts

app/src/lib/server/data/
  singles-training-session.ts
  player-singles-training-stats.ts

app/src/pages/api/games/singles-training/
  session.ts
  session/dart.ts
  session/dart/last.ts
  session/play-again.ts

app/src/lib/client/alpine/games/
  singles-training.settings.ts
  singles-training.play.ts

app/src/components/games/singles-training/
  SettingsForm.astro
  SinglesTrainingSettingsShell.astro
  Play.astro
  ScorePanel.astro
  TargetLabel.astro
  DartInput.astro
  Summary.astro
```

---

## 4. Types

```ts
type SinglesTrainingTarget = number | "bull";

type SinglesTrainingDirection = "low-to-high" | "high-to-low" | "random";
type SinglesTrainingMode = "normal" | "hard" | "extreme";
type SinglesTrainingScoring = "traditional" | "uniform";

type SinglesTrainingSettings = {
  direction: SinglesTrainingDirection;
  mode: SinglesTrainingMode;
  scoring: SinglesTrainingScoring;
};

type DartOutcomeType = "miss" | "single" | "double" | "triple";

type DartOutcome = { type: DartOutcomeType };

type DartRecord = {
  targetIndex: number;
  dartInVisit: 0 | 1 | 2;
  outcome: DartOutcome;
  points: number;
};

type SegmentCounts = {
  miss: number;
  single: number;
  double: number;
  triple: number;
};

type SinglesTrainingGameStatus = "active" | "dead" | "completed";

type SinglesTrainingGameState = {
  status: SinglesTrainingGameStatus;
  currentTargetIndex: number;   // 0–20
  currentDartInVisit: 0 | 1 | 2;
  score: number;
  segmentCounts: SegmentCounts;
};

type SinglesTrainingSession = {
  slug: "singles-training";
  settings: SinglesTrainingSettings;
  targetSequence: SinglesTrainingTarget[];
  state: SinglesTrainingGameState;
  dartHistory: DartRecord[];
  createdAt: string;
  updatedAt: string;
};
```

### Minimum hits per mode

| Mode | Min hits after 3 darts |
|---|---|
| normal | 0 |
| hard | 1 |
| extreme | 2 |

---

## 5. Play UI

Based on `app/src/pages/test.astro`.

### Layout

```
[Leave]  Singles Training  [spacer]

┌─ ScorePanel ──────────────────────────┐
│              {score}                  │
│           CURRENT SCORE               │
│  Miss     {n}                         │
│  Single   {n}                         │
│  Double   {n}                         │
│  Triple   {n}                         │
└───────────────────────────────────────┘

Your target is {target}

┌─ Dart row (3 slots) ──────────────────┐
│  {dart1}  │  {dart2}  │  {dart3}     │  ← "-" when empty
└───────────────────────────────────────┘

Number target input:
┌─ S{n} ─── D{n} ─── T{n} ──────────────┐
├─ <= ───────────── Miss ───────────────┤

Bull target input (2×2):
┌─ Single ─── Bull ─────────────────────┐
├─ <= ───────────── Miss ───────────────┤
```

### Dart row labels

| Outcome | Display |
|---|---|
| Single on number | `S{n}` |
| Double on number | `D{n}` |
| Triple on number | `T{n}` |
| Outer bull | `25` |
| Inner bull | `Bull` |
| Miss | `Miss` |
| Empty slot | `-` |

### Interaction

- Tap outcome → POST dart → fill current slot → auto-advance at dart 3 (if alive)
- `<=` → DELETE last dart (disabled when `dartHistory.length === 0`)
- Leave → confirmation modal (abandon session, no stats)

---

## 6. End-of-game summary

Shown when `status === "completed"` or `status === "dead"`.

| Field | Source |
|---|---|
| Headline | "Game Complete" or "Game Over" |
| Score | `state.score` |
| Miss / Single / Double / Triple | `state.segmentCounts` |
| Hit ratio | `(single + double + triple) / dartHistory.length` |
| D1 success rate | hits on dart 1 / visits with ≥1 dart thrown |
| D2 success rate | hits on dart 2 / visits with ≥2 darts thrown |
| D3 success rate | hits on dart 3 / visits with 3 darts thrown |

**Actions:**

- Prompt: "Do you want to play again?"
- **Yes** → `POST session/play-again` → reload play with new session
- **No** → navigate to `/games`

---

## 7. Global stats

```ts
type PlayerSinglesTrainingStats = {
  gamesCompleted: number;
  gamesFailed: number;
  totalDartsThrown: number;
  totalHits: number;
  totalScore: number;
  dartPositionHits: [number, number, number];
  dartPositionAttempts: [number, number, number];
  bestHitRatio: number;
  bestScore: number;
};
```

Updated **once** on complete or dead. Not updated on manual leave or mid-game undo.

| Event | Updates |
|---|---|
| completed | `gamesCompleted += 1` |
| dead | `gamesFailed += 1` |
| both | accumulate darts, hits, score, dart position arrays; update bests |

---

## 8. Validation & errors

| Input | Rule | Code |
|---|---|---|
| direction | one of 3 values | `INVALID_GAME_SETTINGS` |
| mode | one of 3 values | `INVALID_GAME_SETTINGS` |
| scoring | one of 2 values | `INVALID_GAME_SETTINGS` |
| dart outcome | valid for current target | `INVALID_DART_OUTCOME` |
| dart POST | active session, not terminal | `GAME_COMPLETED` |
| undo | `dartHistory.length > 0` | `NO_DARTS_TO_UNDO` |
| create session | no existing session | `SESSION_EXISTS` |

### API response shapes

```ts
type SinglesTrainingSummary = {
  status: "completed" | "dead";
  score: number;
  segmentCounts: SegmentCounts;
  hitRatio: number;
  dartPositionSuccessRates: [number, number, number];
  targetsCompleted: number;
  dartsThrown: number;
};

type SinglesTrainingSessionSuccess = {
  ok: true;
  session: SinglesTrainingSession;
  terminal?: boolean;
  summary?: SinglesTrainingSummary;
};
```

---

## 9. Registration touchpoints

- `SEED_GAMES`: `{ slug: "singles-training", displayName: "Singles Training", sortOrder: 5, enabled: true, released: true }`
- `GAME_CODES`: `"singles-training": "st"`
- `components.ts` registry
- `[game].astro` session load + redirect guard
- `settings-[game].astro` active session check + settings shell
- `app.factory.ts` Alpine registrations
- `api/types.ts`: `SinglesTrainingSessionSuccess`
- `errors.constants.ts`: `INVALID_DART_OUTCOME`, `NO_DARTS_TO_UNDO`
- **Games overview** (`app/src/pages/games.astro`): appears automatically via `getGameTypes()` when `released: true`; verify with catalog/API tests

---

## 10. Testing

| Layer | Coverage |
|---|---|
| target-sequence | low-to-high, high-to-low, random (length 21, all targets present) |
| dart | points (traditional/uniform, bull segments) |
| state | apply dart, visit completion, dead trigger, complete trigger, revert dart |
| summary | hit ratio, dart position rates |
| stats | apply on complete/dead |
| validation | settings + dart outcome |
| session data | blob CRUD |
| API | session create, dart POST, undo, play-again |
| Alpine | settings form, play flow |
| Assembly | play page renders; games catalog includes singles-training |

---

## 11. Out of scope

- Multi-player
- Settings remembered across games (beyond play-again same settings)
- Per-dart global stats updates (stats on terminal only)
- Timed mode
- Checkout hints / number pad input
