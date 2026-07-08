# Player Statistics — Design Spec

> Input for `writing-plans` skill. Apply `emil-design-eng` during UI implementation. UI references: `docs/superpowers/context/inspiration-img/`.

**Date:** 2026-06-30  
**Scope:** Time-series stat collection on game completion; homepage player profile with liquid metric cards and Chart.js sparklines; foundation for `/statistics` page (deferred UI).

---

## 1. Overview

Dart Counter stores **lifetime aggregates** per game (`player_501_stats`, etc.) but has no per-completion history. The homepage shows a static preview (`index.astro`) with hardcoded values.

This feature adds:

1. **Completion events** — append-only row per finished game with raw totals for profile metrics and future analytics.
2. **Homepage profile** — nickname, games played/won, three **liquid metric cards** (50% width) with cumulative all-time sparklines.
3. **Chart.js** — full-bleed background sparklines in metric cards (Approach 1 from brainstorming).

| Item | Value |
| ---- | ----- |
| Homepage layout | Single player profile (not per-game cards) |
| Metric cards | 50% width, 2-column grid; sparkline fills card background |
| Delta “vs last month” | **Not shown** on homepage (computed server-side for future `/statistics`) |
| Chart library | `chart.js` (vanilla; no React / shadcn charts) |
| Sparkline semantics | Cumulative **all-time** profile average after each completion in the last 30 days |
| Statistics page | Deferred — personal bests, milestone counts, singles accuracy |

---

## 2. Decisions log (brainstorming)

| Topic | Decision |
| ----- | -------- |
| Homepage scope | Option A — one player profile block |
| Chart approach | Completion events + Chart.js sparklines |
| 3-dart avg vs scoring avg | **Distinct** — 3-dart includes double/checkout phase; scoring avg does not |
| Checkout % | Doubles-based; sources: 501 + Ten Up One Down |
| Sparkline data | Running all-time average at each completion timestamp (bad sessions pull line down) |
| Homepage delta UI | Removed per user feedback |
| Card layout | 50% width; label + value overlay on full-bleed chart (iOS liquid-glass feel) |
| Games played / won | Plain stat cells (no chart), 50% grid — same row pattern as current preview |
| Milestones (100+/120+/140+/180) | Store per completion; display on `/statistics` only |
| Singles / doubles accuracy | Store raw hits + darts; display on `/statistics` later |
| shadcn / Recharts | Not used — stack is Astro + Alpine + Tailwind |

---

## 3. Metric definitions

All profile headline values use **weighted cumulative** math (totals ÷ totals), never a simple average of per-game averages.

### 3.1 Three-dart average (homepage)

| Property | Value |
| -------- | ----- |
| Formula | `Σ pointsScored ÷ (Σ dartsThrown ÷ 3)` |
| Source games | **501 only** |
| Per-completion extract | User visits: sum positive `remainingBefore − remainingAfter`; sum `dartsThrown` |
| Display | `font-mono`, 2 decimal places (e.g. `45.12`) |

### 3.2 Scoring average (homepage)

| Property | Value |
| -------- | ----- |
| Formula | `Σ scoringPoints ÷ Σ scoringVisits` |
| Source games | **501** (user visit scores) + **Score Training** (round `visitScore`) |
| Rationale | Visit-level scoring without the double-phase drag that lowers 3-dart avg |
| 501 extract | Each user visit contributes `visitScore` as one scoring visit |
| Score Training extract | Each round contributes `visitScore`; `scoringPoints` = sum of visit scores |
| Display | `font-mono`, 1 decimal place (e.g. `48.3`) |

### 3.3 Checkout percentage (homepage)

| Property | Value |
| -------- | ----- |
| Formula | `Σ doubleHits ÷ Σ doubleAttempts × 100` |
| Source games | **501** + **Ten Up One Down** |
| 501 extract | Same rules as `applyGameCompletionToDartStats` / `player_dart_stats` |
| TUOD extract | Same rules as `applyRoundToStats` per round |
| Display | `font-mono`, 1 decimal + `%` (e.g. `14.2%`) |

### 3.4 Games played / games won (homepage)

| Metric | Source |
| ------ | ------ |
| Games played | Sum of `gamesCompleted` across `player_501_stats`, `player_score_training_stats`, `player_singles_training_stats`; plus TUOD completions (no dedicated stats table — use completion count or add counter) |
| Games won | `player_501_stats.gamesWon` only (only released game with win/loss) |

**TUOD games played:** Count rows in `player_stat_completions` where `game_slug = 'ten-up-one-down'`, or increment a field on completion. Prefer completion count for consistency.

### 3.5 Deferred — statistics page only

| Metric | Source | Notes |
| ------ | ------ | ----- |
| Personal bests per game | Extend existing aggregate tables + completion snapshots | e.g. `bestMatchAverage`, `bestGameAverage`, `bestHitRatio` |
| 100+ / 120+ / 140+ / 180 | Per-completion visit score counts | Thresholds on visit/round scores ≥ 100, 120, 140, 180 |
| Singles accuracy | `totalHits ÷ totalDartsThrown` | Per game + cumulative; doubles training later |

---

## 4. Data model

### 4.1 New table: `player_stat_completions`

```sql
CREATE TABLE player_stat_completions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  entry_env     varchar(8) NOT NULL DEFAULT 'prod',
  game_slug     varchar(64) NOT NULL,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  -- 3-dart avg (501)
  points_scored     integer NOT NULL DEFAULT 0,
  darts_thrown      integer NOT NULL DEFAULT 0,
  -- scoring avg (501 + score training)
  scoring_points    integer NOT NULL DEFAULT 0,
  scoring_visits    integer NOT NULL DEFAULT 0,
  -- checkout % (501 + TUOD)
  double_attempts   integer NOT NULL DEFAULT 0,
  double_hits       integer NOT NULL DEFAULT 0,
  -- milestones (statistics page)
  visits_100_plus   smallint NOT NULL DEFAULT 0,
  visits_120_plus   smallint NOT NULL DEFAULT 0,
  visits_140_plus   smallint NOT NULL DEFAULT 0,
  visits_180        smallint NOT NULL DEFAULT 0,
  -- accuracy (statistics page; singles now, doubles later)
  segment_hits      integer NOT NULL DEFAULT 0,
  segment_attempts  integer NOT NULL DEFAULT 0
);

CREATE INDEX player_stat_completions_user_completed_idx
  ON player_stat_completions (user_id, entry_env, completed_at);
```

Drizzle schema in `app/db/schema.ts`; migration committed with schema.

**Row semantics:** One row per successful `POST /api/games/{slug}/complete`. Games with no contribution to a metric store `0` in those columns (e.g. Score Training has no checkout fields).

### 4.2 Existing tables

Keep and continue updating on completion:

- `player_501_stats`, `player_score_training_stats`, `player_singles_training_stats`, `player_dart_stats`

No breaking changes to completion APIs beyond appending a completion row.

### 4.3 Shared module: `lib/shared/stats/`

Extend the stats barrel with:

| File | Role |
| ---- | ---- |
| `types.ts` | `StatCompletionRecord`, `ProfileMetrics`, `SparklineSeries`, `MetricKind` |
| `completion-snapshot.ts` | Per-game builders: `build501CompletionSnapshot(session)`, etc. |
| `profile-metrics.ts` | `computeProfileMetrics(completions[])`, `computeSparklineSeries(completions[], metric, windowDays)` |
| `milestones.ts` | `countVisitMilestones(scores: number[])` → `{ v100, v120, v140, v180 }` |
| `index.ts` | Barrel exports |

**Internal imports:** relative siblings only. **External:** `@lib/shared/stats` barrel.

Add ESLint boundary for `@lib/shared/stats/*` deep imports (mirror pilot modules).

---

## 5. Completion pipeline

On each game's `complete` API (after validation, before response):

```text
validated session
  → buildSummary (existing)
  → applyGameCompletionToStats (existing aggregates)
  → save*Stats (existing)
  → build*CompletionSnapshot(session)   // NEW
  → insertPlayerStatCompletion(userId, snapshot)  // NEW
  → incrementPlayCount (existing)
```

**Games wired in v1:**

| Slug | Snapshot fields populated |
| ---- | ------------------------- |
| `501` | All 501 + dart + milestone fields from user `visitHistory` |
| `score-training` | `scoring_points`, `scoring_visits`, milestones from round visit scores |
| `ten-up-one-down` | `double_attempts`, `double_hits` (from rounds) |
| `singles-training` | `segment_hits`, `segment_attempts` only |

**Server data:** `lib/server/data/player-stat-completions.ts`

- `insertPlayerStatCompletion(userId, record)`
- `getPlayerStatCompletions(userId, since?: Date)`
- `getProfileDashboardData(userId)` — returns metrics + sparkline series for homepage

---

## 6. Sparkline computation

### 6.1 Profile headline values

Compute from **all** completion rows for the user (entry-env scoped):

```ts
threeDartAverage = sum(pointsScored) / (sum(dartsThrown) / 3)  // 501 rows only
scoringAverage   = sum(scoringPoints) / sum(scoringVisits)      // 501 + score-training rows
checkoutPct      = sum(doubleHits) / sum(doubleAttempts) * 100  // 501 + TUOD rows
```

Guard: denominator `0` → display `—` or `0.0` (pick one; use `—` when no data).

### 6.2 Sparkline series (last 30 days)

For each metric, filter completions that contribute to that metric, ordered by `completed_at ASC`.

For each completion `i` in the filtered list (include completions up to 30 days ago as context; **plot points** where `completed_at >= now − 30d`):

1. Take prefix `completions[0..i]`.
2. Compute cumulative profile value for that metric using prefix totals (same formulas as §6.1).
3. Emit `{ x: completed_at, y: cumulativeValue }`.

**Example (3-dart avg):**

| Date | Event | Cumulative 3-dart avg |
| ---- | ----- | --------------------- |
| Jul 1 | 501 game | 45.0 |
| Jul 12 | 501 game (bad) | 44.7 |
| Jul 26 | 501 game | 45.6 |

Bad sessions visibly dip the line.

### 6.3 Empty / partial states

| State | Homepage behavior |
| ----- | ----------------- |
| No completions | Show nickname; metrics show `—`; hide sparkline canvas (or flat line at 0 — prefer hide) |
| Completions exist but none in 30d window | Show headline all-time values; sparkline hidden or single-point dot |
| ≥ 2 points in window | Render full-bleed sparkline |

### 6.4 Delta (computed, not displayed on homepage)

Store helper `computeMonthDelta(current, completions, metric)` for future `/statistics`:

- `current` = all-time metric now
- `past` = all-time metric using only completions with `completed_at <= now − 30d`
- Return absolute or percentage change by metric kind

---

## 7. Homepage UI

### 7.1 Page structure (`index.astro`)

Replace static preview with SSR data from `getProfileDashboardData(session.userId)` and `getPreferences(userId)`.

```text
<main>
  <section>  <!-- Statistics -->
    <header> Statistics + divider </header>
    <ProfileStatsSection
      displayName={...}
      gamesPlayed={...}
      gamesWon={...}
      metrics={profileMetrics}
      sparklines={sparklineSeries}
    />
  </section>
  <!-- Quick Start: re-enable when ready (out of scope) -->
</main>
```

### 7.2 Layout

```text
┌─ Statistics ──────────────────────────────┐
│ NICKNAME                                │
│ {displayName}                           │
│                                         │
│ ┌─────────────┐ ┌─────────────┐         │
│ │ {gamesPlayed}│ │ {gamesWon}  │  50%   │
│ │ Games Played │ │ Games Won   │         │
│ └─────────────┘ └─────────────┘         │
│                                         │
│ ┌─ liquid ────┐ ┌─ liquid ────┐         │
│ │ [sparkline] │ │ [sparkline] │  50%   │
│ │ 3-DART AVG  │ │ SCORING AVG │         │
│ │ 45.12       │ │ 48.3        │         │
│ └─────────────┘ └─────────────┘         │
│ ┌─ liquid ────┐                         │
│ │ [sparkline] │                 50%   │
│ │ CHECKOUT %  │                         │
│ │ 14.2%       │                         │
│ └─────────────┘                         │
└─────────────────────────────────────────┘
```

Grid: `grid grid-cols-2 gap-4`. Plain stat cells and metric cards both `w-full` within half-column cells.

### 7.3 `ProfileMetricCard.astro`

Props: `label`, `value`, `formattedValue`, `metricKind`, `sparklinePoints: {x,y}[]`, `chartColorToken` (`chart-1` | `chart-2` | `chart-3`).

**DOM layers (bottom → top):**

1. `canvas` — `absolute inset-0 h-full w-full`
2. `.card-metric-liquid-scrim` — gradient overlay for legibility
3. Text — `relative z-10 p-3`

Min height: `min-h-[7rem]` (tune in implementation).

### 7.4 CSS: `.card-metric-liquid` (`global.css`)

```css
.card-metric-liquid {
  @apply relative overflow-hidden rounded-xl border border-border/50;
  background: var(--gradient-card-surface);
  min-height: 7rem;
}

.card-metric-liquid-scrim {
  @apply pointer-events-none absolute inset-0;
  background: linear-gradient(
    160deg,
    hsl(var(--card) / 0.85) 0%,
    hsl(var(--card) / 0.45) 45%,
    transparent 100%
  );
}
```

Optional subtle `backdrop-blur-[2px]` on scrim if performance acceptable on target devices.

**Inspiration mapping:**

| Reference | Applied |
| --------- | ------- |
| Masteruix sparkline cards | Metric card structure, trend line as hero |
| Jeremy Blaze / Atex | Full-width embedded chart, no axes |
| iOS liquid glass | Text over muted transparent chart + scrim |
| Creava delta subline | **Not used** on homepage |

Use existing tokens: `--chart-1` (3-dart), `--chart-2` (scoring), `--chart-3` (checkout). Line ~60% opacity; area fill ~10%.

### 7.5 Chart.js client wiring

| File | Role |
| ---- | ---- |
| `lib/client/charts/sparkline.ts` | `createSparkline(canvas, points, colorCss)` / `destroySparkline(chart)` |
| `lib/client/alpine/home-stats.ts` | `homeStats()` factory — reads `data-sparklines` JSON, inits charts in `init()`, destroys in teardown |
| `app.factory.ts` | Register `Alpine.data('homeStats', homeStats)` |

**Chart options (homepage):**

- `responsive: true`, `maintainAspectRatio: false`
- `plugins: { legend: false, tooltip: false }`
- `scales: { x: { display: false }, y: { display: false } }`
- `elements: { point: { radius: 0 }, line: { tension: 0.35, borderWidth: 2 } }`
- `fill: true` with gradient from line color

Read colors via `getComputedStyle(document.documentElement).getPropertyValue('--chart-N')` or parse from `hsl(var(--chart-1))` helper.

**Dependency:** add `chart.js` to `app/package.json`.

`ProfileStatsSection.astro` root: `x-data="homeStats()"` with escaped JSON payload.

---

## 8. Statistics page (deferred)

`statistics.astro` remains a stub in v1. Data layer and milestone columns support a follow-up spec:

- Per-game personal bests
- 100+ / 120+ / 140+ / 180 totals (and optional donut — Creava inspiration)
- Singles accuracy; doubles training when released
- Larger charts with 1M / 3M / All selectors (AJ Abbasi / Atex inspiration)
- Per-game list rows with inline sparklines (Atex Markets inspiration)
- Link from homepage Statistics header → `/statistics`

---

## 9. Error handling

| Case | Behavior |
| ---- | -------- |
| Completion insert fails | Log; still return `{ ok: true, summary }` if aggregates saved — **or** fail transactionally (prefer **single transaction**: aggregate + completion in one DB transaction; rollback both on failure) |
| Homepage fetch fails | Empty section + graceful fallback (no crash); log server-side |
| Malformed sparkline JSON client-side | Skip chart init; show value overlay only |
| User with no displayName | Fallback `"You"` (existing pattern) |

---

## 10. Testing

| Layer | Tests |
| ----- | ----- |
| `completion-snapshot.ts` | Unit: 501 / score-training / TUOD / singles snapshots from fixture sessions |
| `profile-metrics.ts` | Unit: cumulative averages, sparkline prefix series, month delta helper |
| `milestones.ts` | Unit: threshold counts |
| `player-stat-completions` data | Unit with mock DB: insert + query |
| Completion APIs | Extend existing API tests: assert `insertPlayerStatCompletion` called with expected snapshot |
| `ProfileMetricCard` | Assembly: assert liquid class, canvas, overlay structure |
| Homepage | Assembly: `index.astro` imports `ProfileStatsSection`, fetches dashboard data |

---

## 11. Verification

```bash
cd app
npm run check
npm test
npm run lint
npx fallow
./scripts/audit-imports.sh
npm run db:migrate   # after schema change
```

**Manual:** complete 2+ 501 games → homepage shows live metrics + sparklines. Complete score-training → scoring avg updates. Complete TUOD → checkout % updates.

**Curl:** existing `curl-verify-501.sh` must still pass; extend or add smoke for homepage SSR containing display name when logged in.

---

## 12. Out of scope (v1)

- `/statistics` page UI
- Quick Start section re-enable on homepage
- Doubles training accuracy
- Time-range selectors on homepage (fixed 30-day window)
- React / shadcn chart components
- Backfill of historical completions (only new completions from deploy forward)
- Per-game homepage cards

---

## 13. File checklist (implementation reference)

| Action | Path |
| ------ | ---- |
| Add | `app/db/schema.ts` — `playerStatCompletions` |
| Add | `app/drizzle/migrations/00xx_player_stat_completions.sql` |
| Add | `app/src/lib/shared/stats/completion-snapshot.ts` |
| Add | `app/src/lib/shared/stats/profile-metrics.ts` |
| Add | `app/src/lib/shared/stats/milestones.ts` |
| Extend | `app/src/lib/shared/stats/types.ts`, `index.ts` |
| Add | `app/src/lib/server/data/player-stat-completions.ts` |
| Extend | `app/src/pages/api/games/*/complete.ts` (4 games) |
| Add | `app/src/components/stats/ProfileMetricCard.astro` |
| Add | `app/src/components/stats/ProfileStatsSection.astro` |
| Add | `app/src/lib/client/charts/sparkline.ts` |
| Add | `app/src/lib/client/alpine/home-stats.ts` |
| Extend | `app/src/lib/client/alpine/app.factory.ts` |
| Extend | `app/src/styles/global.css` — `.card-metric-liquid` |
| Extend | `app/src/pages/index.astro` |
| Add | `app/tests/lib/shared/stats/*.test.ts` |
| Extend | `app/eslint.config.js` — stats barrel boundary |
| Add | `chart.js` dependency |

---

## 14. Related docs

| Topic | Path |
| ----- | ---- |
| UI inspiration | `docs/superpowers/context/inspiration-img/` |
| Theme tokens | `docs/superpowers/specs/2026-06-30-theme-rebrand-design.md` |
| Completion pattern | `AGENTS.md` § Client session pattern |
| Module barrels | `docs/superpowers/context/module-barrels-types-handoff.md` |
