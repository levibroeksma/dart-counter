# Player Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect per-game completion stats, compute cumulative profile metrics, and replace the homepage static preview with liquid metric cards (50% width, full-bleed Chart.js sparklines) using the existing dark theme in `global.css`.

**Architecture:** Append-only `player_stat_completions` rows on each `complete` API call. Shared `lib/shared/stats` computes weighted profile metrics and 30-day cumulative sparkline series server-side. Homepage SSR renders reusable Astro stat components; Alpine `homeStats` hydrates Chart.js canvases client-side. Repeated UI patterns extracted into `components/stats/`\* and `lib/shared/stats/format-profile.ts`.

**Tech Stack:** Astro 6, Alpine.js 3, Tailwind CSS 4, Chart.js, Drizzle ORM, Neon Postgres, Vitest

**Spec:** `docs/superpowers/specs/2026-06-30-player-statistics-design.md`
**UI inspiration:** `docs/superpowers/context/inspiration-img/`
**Theme:** `app/src/styles/global.css` (`--gradient-card-surface`, `--chart-1..3`, `.section-label`, `.card`, `--ease-out`)
**Working directory:** `app/`

---

## File Structure Overview

| File                                             | Responsibility                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `db/schema.ts`                                   | `playerStatCompletions` Drizzle table                                   |
| `drizzle/migrations/00xx_*.sql`                  | Migration SQL                                                           |
| `src/lib/shared/stats/types.ts`                  | `StatCompletionRecord`, `ProfileMetrics`, `MetricKind`, sparkline types |
| `src/lib/shared/stats/milestones.ts`             | Visit score threshold counts                                            |
| `src/lib/shared/stats/profile-metrics.ts`        | Cumulative metrics, sparklines, month-delta helper                      |
| `src/lib/shared/stats/completion-snapshot.ts`    | Per-game snapshot builders                                              |
| `src/lib/shared/stats/format-profile.ts`         | Display formatting (`45.12`, `14.2%`, `—`)                              |
| `src/lib/shared/stats/index.ts`                  | Barrel exports                                                          |
| `src/lib/server/data/player-stat-completions.ts` | Insert + query + `getProfileDashboardData`                              |
| `src/pages/api/games/*/complete.ts`              | Append snapshot after aggregate save (4 games)                          |
| `src/lib/client/charts/chart-theme.ts`           | Read `--chart-N` HSL from `documentElement`                             |
| `src/lib/client/charts/sparkline.ts`             | Chart.js create/destroy (full-bleed, no axes)                           |
| `src/lib/client/alpine/home-stats.ts`            | Alpine factory: init charts from `data-sparklines`                      |
| `src/lib/client/alpine/app.factory.ts`           | Register `homeStats`                                                    |
| `src/styles/global.css`                          | `.card-metric-liquid`, `.card-metric-liquid-scrim`                      |
| `src/components/stats/StatsSectionHeader.astro`  | Reusable section title + divider                                        |
| `src/components/stats/ProfileStatCell.astro`     | Plain value + label cell (games played/won)                             |
| `src/components/stats/ProfileMetricCard.astro`   | Liquid card: canvas bg + scrim + overlay text                           |
| `src/components/stats/ProfileStatsSection.astro` | Nickname + grid of cells + metric cards                                 |
| `src/pages/index.astro`                          | SSR dashboard data + `ProfileStatsSection`                              |
| `tests/helpers/mock-db.ts`                       | Mock table for `playerStatCompletions`                                  |

**Component reuse rule:** Anything rendered twice (section header pattern, stat cell, metric card, metric formatting, chart color resolution) lives in one module — no copy-paste between `index.astro` and future `/statistics`.

---

## Frontend Design Tokens (apply to all UI tasks)

**Subject:** Dart player at home glancing at long-term form — pub-scoreboard calm, not fintech noise.

| Token                                                                     | Usage                         |
| ------------------------------------------------------------------------- | ----------------------------- |
| `font-display` + `text-2xl uppercase tracking-wide text-muted-foreground` | Section header ("Statistics") |
| `text-xs uppercase tracking-wider text-muted-foreground`                  | Metric labels                 |
| `font-mono font-bold text-foreground`                                     | Live values                   |
| `var(--gradient-card-surface)`                                            | Card base (existing `.card`)  |
| `hsl(var(--chart-1))`                                                     | 3-dart avg line               |
| `hsl(var(--chart-2))`                                                     | Scoring avg line              |
| `hsl(var(--chart-3))`                                                     | Checkout % line               |
| `border-border/50`, `rounded-xl`, `shadow-card`                           | Liquid card chrome            |
| `grid grid-cols-2 gap-4`                                                  | 50% width cells               |

**Signature element:** Full-bleed sparkline as ambient background with glass scrim — the chart _is_ the card (Masteruix / iOS liquid reference), not a chart below text.

---

## Verification Gate (final task)

```bash
cd app && npm run check && npm test && npx fallow && npm run lint && ./scripts/audit-imports.sh
npm run db:migrate
```

**Manual:** Complete 2+ 501 games → homepage shows nickname, games played, 3-dart avg with sparkline. Complete score-training → scoring avg updates. Complete TUOD → checkout % updates.

**Curl:** `./scripts/curl-verify-501.sh` still passes.

---

### Task 1: Add Chart.js dependency

**Files:**

- Modify: `app/package.json`

- [ ] **Step 1: Install**

```bash
cd app && npm install chart.js
```

Expected: `package.json` dependencies includes `"chart.js": "^4.x"`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add chart.js for homepage stat sparklines"
```

---

### Task 2: Database schema — `player_stat_completions`

**Files:**

- Modify: `app/db/schema.ts`
- Modify: `app/db/index.ts`
- Create: migration via `npm run db:generate`

- [ ] **Step 1: Add table to** `schema.ts` (after existing stats tables)

```ts
export const playerStatCompletions = pgTable(
  'player_stat_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    entryEnv: entryEnvColumn(),
    gameSlug: varchar('game_slug', { length: 64 }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    pointsScored: integer('points_scored').notNull().default(0),
    dartsThrown: integer('darts_thrown').notNull().default(0),
    scoringPoints: integer('scoring_points').notNull().default(0),
    scoringVisits: integer('scoring_visits').notNull().default(0),
    doubleAttempts: integer('double_attempts').notNull().default(0),
    doubleHits: integer('double_hits').notNull().default(0),
    visits100Plus: smallint('visits_100_plus').notNull().default(0),
    visits120Plus: smallint('visits_120_plus').notNull().default(0),
    visits140Plus: smallint('visits_140_plus').notNull().default(0),
    visits180: smallint('visits_180').notNull().default(0),
    segmentHits: integer('segment_hits').notNull().default(0),
    segmentAttempts: integer('segment_attempts').notNull().default(0),
  },
  (table) => [
    index('player_stat_completions_user_completed_idx').on(
      table.userId,
      table.entryEnv,
      table.completedAt,
    ),
  ],
);
```

Import `index`, `smallint` from `drizzle-orm/pg-core` if not already present.

- [ ] **Step 2: Export from** `db/index.ts`

```ts
export { playerStatCompletions } from './schema';
```

- [ ] **Step 3: Generate and run migration**

```bash
cd app && npm run db:generate && npm run db:migrate
```

Expected: new SQL file under `drizzle/migrations/`, migrate exits 0.

- [ ] **Step 4: Commit**

```bash
git add db/schema.ts db/index.ts drizzle/
git commit -m "feat(db): add player_stat_completions table"
```

---

### Task 3: Stats types + milestones

**Files:**

- Modify: `app/src/lib/shared/stats/types.ts`
- Create: `app/src/lib/shared/stats/milestones.ts`
- Create: `app/tests/lib/shared/stats/milestones.test.ts`
- Modify: `app/src/lib/shared/stats/index.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/lib/shared/stats/milestones.test.ts
import { describe, expect, it } from 'vitest';
import { countVisitMilestones } from '@lib/shared/stats';

describe('countVisitMilestones', () => {
  it('counts threshold buckets', () => {
    expect(countVisitMilestones([60, 100, 120, 140, 180])).toEqual({
      visits100Plus: 4,
      visits120Plus: 3,
      visits140Plus: 2,
      visits180: 1,
    });
  });

  it('returns zeros for empty input', () => {
    expect(countVisitMilestones([])).toEqual({
      visits100Plus: 0,
      visits120Plus: 0,
      visits140Plus: 0,
      visits180: 0,
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd app && npm test -- tests/lib/shared/stats/milestones.test.ts
```

- [ ] **Step 3: Implement types + milestones**

`types.ts` additions:

```ts
export type MetricKind =
  | 'threeDartAverage'
  | 'scoringAverage'
  | 'checkoutPercentage';

export type VisitMilestoneCounts = {
  visits100Plus: number;
  visits120Plus: number;
  visits140Plus: number;
  visits180: number;
};

export type StatCompletionRecord = {
  id: string;
  gameSlug: string;
  completedAt: string;
  pointsScored: number;
  dartsThrown: number;
  scoringPoints: number;
  scoringVisits: number;
  doubleAttempts: number;
  doubleHits: number;
  visits100Plus: number;
  visits120Plus: number;
  visits140Plus: number;
  visits180: number;
  segmentHits: number;
  segmentAttempts: number;
};

export type ProfileMetricValue = {
  kind: MetricKind;
  value: number | null;
};

export type ProfileMetrics = {
  threeDartAverage: number | null;
  scoringAverage: number | null;
  checkoutPercentage: number | null;
};

export type SparklinePoint = { x: string; y: number };

export type SparklineSeries = {
  kind: MetricKind;
  points: SparklinePoint[];
};
```

`milestones.ts`:

```ts
import type { VisitMilestoneCounts } from './types';

export function countVisitMilestones(scores: number[]): VisitMilestoneCounts {
  let visits100Plus = 0;
  let visits120Plus = 0;
  let visits140Plus = 0;
  let visits180 = 0;

  for (const score of scores) {
    if (score >= 100) visits100Plus += 1;
    if (score >= 120) visits120Plus += 1;
    if (score >= 140) visits140Plus += 1;
    if (score >= 180) visits180 += 1;
  }

  return { visits100Plus, visits120Plus, visits140Plus, visits180 };
}
```

Export from `index.ts`.

- [ ] **Step 4: Run test — expect PASS**

```bash
cd app && npm test -- tests/lib/shared/stats/milestones.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/stats/ tests/lib/shared/stats/milestones.test.ts
git commit -m "feat(stats): add types and visit milestone counter"
```

---

### Task 4: Profile metrics computation

**Files:**

- Create: `app/src/lib/shared/stats/profile-metrics.ts`
- Create: `app/tests/lib/shared/stats/profile-metrics.test.ts`
- Modify: `app/src/lib/shared/stats/index.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/shared/stats/profile-metrics.test.ts
import { describe, expect, it } from 'vitest';
import {
  computeProfileMetrics,
  computeSparklineSeries,
  computeMonthDelta,
} from '@lib/shared/stats';
import type { StatCompletionRecord } from '@lib/shared/stats';

function row(
  overrides: Partial<StatCompletionRecord> &
    Pick<StatCompletionRecord, 'completedAt'>,
): StatCompletionRecord {
  return {
    id: '1',
    gameSlug: '501',
    pointsScored: 0,
    dartsThrown: 0,
    scoringPoints: 0,
    scoringVisits: 0,
    doubleAttempts: 0,
    doubleHits: 0,
    visits100Plus: 0,
    visits120Plus: 0,
    visits140Plus: 0,
    visits180: 0,
    segmentHits: 0,
    segmentAttempts: 0,
    ...overrides,
  };
}

describe('computeProfileMetrics', () => {
  it('computes weighted 3-dart average from 501 rows only', () => {
    const metrics = computeProfileMetrics([
      row({
        completedAt: '2026-07-01T00:00:00.000Z',
        pointsScored: 501,
        dartsThrown: 9,
      }),
      row({
        completedAt: '2026-07-02T00:00:00.000Z',
        pointsScored: 300,
        dartsThrown: 9,
      }),
    ]);
    expect(metrics.threeDartAverage).toBeCloseTo(133.67, 1);
  });

  it('returns null when no contributing data', () => {
    expect(computeProfileMetrics([])).toEqual({
      threeDartAverage: null,
      scoringAverage: null,
      checkoutPercentage: null,
    });
  });
});

describe('computeSparklineSeries', () => {
  it('emits cumulative prefix averages for last-30d window', () => {
    const now = new Date('2026-07-26T12:00:00.000Z');
    const completions = [
      row({
        id: 'a',
        completedAt: '2026-06-20T00:00:00.000Z',
        pointsScored: 450,
        dartsThrown: 30,
      }),
      row({
        id: 'b',
        completedAt: '2026-07-01T00:00:00.000Z',
        pointsScored: 501,
        dartsThrown: 9,
      }),
      row({
        id: 'c',
        completedAt: '2026-07-12T00:00:00.000Z',
        pointsScored: 200,
        dartsThrown: 9,
      }),
    ];
    const series = computeSparklineSeries(completions, 'threeDartAverage', {
      now,
      windowDays: 30,
    });
    expect(series.points.length).toBe(2);
    expect(series.points[0].y).toBeCloseTo(45, 0);
    expect(series.points[1].y).toBeLessThan(series.points[0].y);
  });
});

describe('computeMonthDelta', () => {
  it('returns absolute delta for averages', () => {
    const now = new Date('2026-07-26T00:00:00.000Z');
    const completions = [
      row({
        completedAt: '2026-06-01T00:00:00.000Z',
        pointsScored: 450,
        dartsThrown: 30,
      }),
      row({
        completedAt: '2026-07-20T00:00:00.000Z',
        pointsScored: 501,
        dartsThrown: 9,
      }),
    ];
    const delta = computeMonthDelta(completions, 'threeDartAverage', now);
    expect(delta).not.toBeNull();
    expect(delta!.absolute).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd app && npm test -- tests/lib/shared/stats/profile-metrics.test.ts
```

- [ ] **Step 3: Implement** `profile-metrics.ts`

```ts
import type {
  MetricKind,
  ProfileMetrics,
  SparklinePoint,
  SparklineSeries,
  StatCompletionRecord,
} from './types';

const WINDOW_DAYS_DEFAULT = 30;

function sum501(rows: StatCompletionRecord[]) {
  return rows.reduce(
    (acc, r) => ({
      points: acc.points + r.pointsScored,
      darts: acc.darts + r.dartsThrown,
    }),
    { points: 0, darts: 0 },
  );
}

function sumScoring(rows: StatCompletionRecord[]) {
  return rows.reduce(
    (acc, r) => ({
      points: acc.points + r.scoringPoints,
      visits: acc.visits + r.scoringVisits,
    }),
    { points: 0, visits: 0 },
  );
}

function sumCheckout(rows: StatCompletionRecord[]) {
  return rows.reduce(
    (acc, r) => ({
      hits: acc.hits + r.doubleHits,
      attempts: acc.attempts + r.doubleAttempts,
    }),
    { hits: 0, attempts: 0 },
  );
}

function threeDartFromRows(rows: StatCompletionRecord[]): number | null {
  const { points, darts } = sum501(rows.filter((r) => r.dartsThrown > 0));
  if (darts === 0) return null;
  return points / (darts / 3);
}

function scoringFromRows(rows: StatCompletionRecord[]): number | null {
  const { points, visits } = sumScoring(
    rows.filter((r) => r.scoringVisits > 0),
  );
  if (visits === 0) return null;
  return points / visits;
}

function checkoutFromRows(rows: StatCompletionRecord[]): number | null {
  const { hits, attempts } = sumCheckout(
    rows.filter((r) => r.doubleAttempts > 0),
  );
  if (attempts === 0) return null;
  return (hits / attempts) * 100;
}

function metricValue(
  rows: StatCompletionRecord[],
  kind: MetricKind,
): number | null {
  if (kind === 'threeDartAverage') return threeDartFromRows(rows);
  if (kind === 'scoringAverage') return scoringFromRows(rows);
  return checkoutFromRows(rows);
}

export function computeProfileMetrics(
  completions: StatCompletionRecord[],
): ProfileMetrics {
  return {
    threeDartAverage: threeDartFromRows(completions),
    scoringAverage: scoringFromRows(completions),
    checkoutPercentage: checkoutFromRows(completions),
  };
}

export function computeSparklineSeries(
  completions: StatCompletionRecord[],
  kind: MetricKind,
  options: { now?: Date; windowDays?: number } = {},
): SparklineSeries {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? WINDOW_DAYS_DEFAULT;
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - windowDays);

  const sorted = [...completions].sort(
    (a, b) =>
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );

  const points: SparklinePoint[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i];
    const at = new Date(row.completedAt);
    if (at < windowStart) continue;
    const prefix = sorted.slice(0, i + 1);
    const y = metricValue(prefix, kind);
    if (y === null) continue;
    points.push({ x: row.completedAt, y });
  }

  return { kind, points };
}

export type MonthDelta = {
  absolute: number;
  percentage: number | null;
};

export function computeMonthDelta(
  completions: StatCompletionRecord[],
  kind: MetricKind,
  now: Date = new Date(),
): MonthDelta | null {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);

  const sorted = [...completions].sort(
    (a, b) =>
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );
  const pastRows = sorted.filter((r) => new Date(r.completedAt) <= cutoff);
  const current = metricValue(sorted, kind);
  const past = metricValue(pastRows, kind);
  if (current === null || past === null) return null;

  const absolute = current - past;
  const percentage = past === 0 ? null : (absolute / past) * 100;
  return { absolute, percentage };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd app && npm test -- tests/lib/shared/stats/profile-metrics.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/stats/profile-metrics.ts tests/lib/shared/stats/profile-metrics.test.ts src/lib/shared/stats/index.ts
git commit -m "feat(stats): add profile metrics and sparkline computation"
```

---

### Task 5: Completion snapshot builders

**Files:**

- Create: `app/src/lib/shared/stats/completion-snapshot.ts`
- Create: `app/tests/lib/shared/stats/completion-snapshot.test.ts`
- Modify: `app/src/lib/shared/stats/index.ts`

- [ ] **Step 1: Write failing 501 snapshot test**

```ts
import { describe, expect, it } from 'vitest';
import { applyVisit, buildFiveOhOneSession } from '@lib/shared/games/501';
import { build501CompletionSnapshot } from '@lib/shared/stats';

describe('build501CompletionSnapshot', () => {
  it('extracts user visit totals and milestones', () => {
    let session = buildFiveOhOneSession({
      matchMode: 'first-to',
      targetCount: 1,
      unit: 'legs',
      players: [{ id: 'u1', type: 'user', name: 'Levi' }],
    });
    for (const score of [180, 180, 141]) {
      session = applyVisit(session, score);
    }
    const snap = build501CompletionSnapshot(session);
    expect(snap.gameSlug).toBe('501');
    expect(snap.dartsThrown).toBe(9);
    expect(snap.scoringVisits).toBe(3);
    expect(snap.visits180).toBe(2);
    expect(snap.visits100Plus).toBe(3);
  });
});
```

Add analogous tests for `buildScoreTrainingCompletionSnapshot`, `buildTenUpOneDownCompletionSnapshot`, `buildSinglesTrainingCompletionSnapshot` using existing game test fixtures.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement builders**

Key 501 logic:

```ts
import type { FiveOhOneSession } from '@lib/shared/games/501';
import { countVisitMilestones } from './milestones';
import type { StatCompletionRecord } from './types';

type CompletionSnapshotInsert = Omit<
  StatCompletionRecord,
  'id' | 'completedAt'
> & {
  completedAt?: string;
};

export function build501CompletionSnapshot(
  session: FiveOhOneSession,
): CompletionSnapshotInsert {
  const user = session.settings.players.find((p) => p.type === 'user');
  const userId = user?.id;
  const visits = session.visitHistory.filter((v) => v.playerId === userId);

  let pointsScored = 0;
  let dartsThrown = 0;
  let scoringPoints = 0;
  let doubleAttempts = 0;
  let doubleHits = 0;

  const visitScores: number[] = [];
  for (const visit of visits) {
    const points = Math.max(visit.remainingBefore - visit.remainingAfter, 0);
    pointsScored += points;
    dartsThrown += visit.dartsThrown;
    scoringPoints += visit.visitScore;
    visitScores.push(visit.visitScore);
    if (visit.dartsOnDouble !== undefined)
      doubleAttempts += visit.dartsOnDouble;
    if (visit.checkout) doubleHits += 1;
  }

  const milestones = countVisitMilestones(visitScores);

  return {
    gameSlug: '501',
    pointsScored,
    dartsThrown,
    scoringPoints,
    scoringVisits: visits.length,
    doubleAttempts,
    doubleHits,
    ...milestones,
    segmentHits: 0,
    segmentAttempts: 0,
  };
}
```

Import session types from game **barrels** (`@lib/shared/games/501`, etc.). Add parallel builders for other slugs per spec §5.

- [ ] **Step 4: Run all snapshot tests — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(stats): add per-game completion snapshot builders"
```

---

### Task 6: Format helpers (DRY display strings)

**Files:**

- Create: `app/src/lib/shared/stats/format-profile.ts`
- Create: `app/tests/lib/shared/stats/format-profile.test.ts`
- Modify: `app/src/lib/shared/stats/index.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  formatThreeDartAverage,
  formatScoringAverage,
  formatCheckoutPercentage,
} from '@lib/shared/stats';

describe('format-profile', () => {
  it('formats averages and empty state', () => {
    expect(formatThreeDartAverage(45.123)).toBe('45.12');
    expect(formatScoringAverage(48.34)).toBe('48.3');
    expect(formatCheckoutPercentage(14.156)).toBe('14.2%');
    expect(formatThreeDartAverage(null)).toBe('—');
  });
});
```

- [ ] **Step 2–4: Implement, test, commit**

```ts
const EMPTY = '—';

export function formatThreeDartAverage(value: number | null): string {
  if (value === null) return EMPTY;
  return value.toFixed(2);
}

export function formatScoringAverage(value: number | null): string {
  if (value === null) return EMPTY;
  return value.toFixed(1);
}

export function formatCheckoutPercentage(value: number | null): string {
  if (value === null) return EMPTY;
  return `${value.toFixed(1)}%`;
}
```

---

### Task 7: Server data layer + mock DB

**Files:**

- Create: `app/src/lib/server/data/player-stat-completions.ts`
- Create: `app/tests/lib/server/data/player-stat-completions.test.ts`
- Modify: `app/tests/helpers/mock-db.ts`

- [ ] **Step 1: Extend mock-db** with `playerStatCompletions` Map, select/insert handlers (mirror `player501Stats` pattern).
- [ ] **Step 2: Write failing data layer test** for `insertPlayerStatCompletion` + `getPlayerStatCompletions` + `getProfileDashboardData`.
- [ ] **Step 3: Implement** `player-stat-completions.ts`

```ts
import { eq, gte, asc } from 'drizzle-orm';
import { db, playerStatCompletions } from '@db/index';
import { getEntryEnv } from '@lib/shared/constants/entry-env';
import { withEntryEnv } from '@lib/server/data/entry-env';
import {
  computeProfileMetrics,
  computeSparklineSeries,
  type MetricKind,
  type ProfileMetrics,
  type SparklineSeries,
  type StatCompletionRecord,
} from '@lib/shared/stats';
import { getPlayer501Stats } from '@lib/server/data/player-501-stats';
import { getPlayerScoreTrainingStats } from '@lib/server/data/player-score-training-stats';
import { getPlayerSinglesTrainingStats } from '@lib/server/data/player-singles-training-stats';

export type ProfileDashboardData = {
  metrics: ProfileMetrics;
  sparklines: SparklineSeries[];
  gamesPlayed: number;
  gamesWon: number;
};

function mapRow(
  row: typeof playerStatCompletions.$inferSelect,
): StatCompletionRecord {
  return {
    id: row.id,
    gameSlug: row.gameSlug,
    completedAt: row.completedAt.toISOString(),
    pointsScored: row.pointsScored,
    dartsThrown: row.dartsThrown,
    scoringPoints: row.scoringPoints,
    scoringVisits: row.scoringVisits,
    doubleAttempts: row.doubleAttempts,
    doubleHits: row.doubleHits,
    visits100Plus: row.visits100Plus,
    visits120Plus: row.visits120Plus,
    visits140Plus: row.visits140Plus,
    visits180: row.visits180,
    segmentHits: row.segmentHits,
    segmentAttempts: row.segmentAttempts,
  };
}

export async function insertPlayerStatCompletion(
  userId: string,
  snapshot: Omit<StatCompletionRecord, 'id' | 'completedAt'> & {
    completedAt?: string;
  },
): Promise<void> {
  await db.insert(playerStatCompletions).values({
    userId,
    entryEnv: getEntryEnv(),
    gameSlug: snapshot.gameSlug,
    completedAt: snapshot.completedAt
      ? new Date(snapshot.completedAt)
      : undefined,
    pointsScored: snapshot.pointsScored,
    dartsThrown: snapshot.dartsThrown,
    scoringPoints: snapshot.scoringPoints,
    scoringVisits: snapshot.scoringVisits,
    doubleAttempts: snapshot.doubleAttempts,
    doubleHits: snapshot.doubleHits,
    visits100Plus: snapshot.visits100Plus,
    visits120Plus: snapshot.visits120Plus,
    visits140Plus: snapshot.visits140Plus,
    visits180: snapshot.visits180,
    segmentHits: snapshot.segmentHits,
    segmentAttempts: snapshot.segmentAttempts,
  });
}

export async function getPlayerStatCompletions(
  userId: string,
): Promise<StatCompletionRecord[]> {
  const rows = await db
    .select()
    .from(playerStatCompletions)
    .where(
      withEntryEnv(
        playerStatCompletions.entryEnv,
        eq(playerStatCompletions.userId, userId),
      ),
    )
    .orderBy(asc(playerStatCompletions.completedAt));
  return rows.map(mapRow);
}

const METRIC_KINDS: MetricKind[] = [
  'threeDartAverage',
  'scoringAverage',
  'checkoutPercentage',
];

export async function getProfileDashboardData(
  userId: string,
): Promise<ProfileDashboardData> {
  const [completions, stats501, scoreTraining, singles] = await Promise.all([
    getPlayerStatCompletions(userId),
    getPlayer501Stats(userId),
    getPlayerScoreTrainingStats(userId),
    getPlayerSinglesTrainingStats(userId),
  ]);

  const tuodGames = completions.filter(
    (c) => c.gameSlug === 'ten-up-one-down',
  ).length;
  const gamesPlayed =
    stats501.gamesCompleted +
    scoreTraining.gamesCompleted +
    singles.gamesCompleted +
    tuodGames;

  return {
    metrics: computeProfileMetrics(completions),
    sparklines: METRIC_KINDS.map((kind) =>
      computeSparklineSeries(completions, kind),
    ),
    gamesPlayed,
    gamesWon: stats501.gamesWon,
  };
}
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(server): add player stat completions data layer"
```

---

### Task 8: Wire completion APIs

**Files:**

- Modify: `app/src/pages/api/games/501/complete.ts`
- Modify: `app/src/pages/api/games/score-training/complete.ts`
- Modify: `app/src/pages/api/games/ten-up-one-down/complete.ts`
- Modify: `app/src/pages/api/games/singles-training/complete.ts`
- Modify: `app/tests/api/games/*/complete.test.ts` (4 files)

- [ ] **Step 1: Mock** `insertPlayerStatCompletion` **in each API test; assert called with expected snapshot.**
- [ ] **Step 2: Add to each** `complete.ts` **after aggregate save:**

```ts
import { build501CompletionSnapshot } from '@lib/shared/stats';
import { insertPlayerStatCompletion } from '@lib/server/data/player-stat-completions';

// inside try block, after save*Stats:
const snapshot = build501CompletionSnapshot(validated.value);
await insertPlayerStatCompletion(auth.userId, snapshot);
```

Use the matching builder per slug. On insert failure, return `SERVER_ERROR` (aggregates already saved — acceptable v1 tradeoff).

- [ ] **Step 3: Run API tests — PASS**

```bash
cd app && npm test -- tests/api/games
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api): record stat completion on game complete"
```

---

### Task 9: Liquid card CSS (`global.css`)

**Files:**

- Modify: `app/src/styles/global.css`

**Frontend-design:** Signature = chart-as-background. Scrim must mute line without killing it — gradient from `hsl(var(--card) / 0.85)` to transparent, not flat opacity on whole card.

- [ ] **Step 1: Add inside** `@layer components`

```css
.card-metric-liquid {
  @apply border-border/50 shadow-card relative min-h-28 overflow-hidden rounded-xl border;
  background: var(--gradient-card-surface);
}

.card-metric-liquid-canvas {
  @apply pointer-events-none absolute inset-0 h-full w-full;
}

.card-metric-liquid-scrim {
  @apply pointer-events-none absolute inset-0;
  background: linear-gradient(
    155deg,
    hsl(var(--card) / 0.88) 0%,
    hsl(var(--card) / 0.5) 40%,
    hsl(var(--card) / 0.15) 100%
  );
}

.card-metric-liquid-content {
  @apply relative z-10 flex h-full min-h-28 flex-col justify-end p-3;
}
```

- [ ] **Step 2: Add reduced-motion guard** — no chart animation needed; ensure no CSS animation on cards.

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "style: add liquid metric card classes"
```

---

### Task 10: Reusable stat components

**Files:**

- Create: `app/src/components/stats/StatsSectionHeader.astro`
- Create: `app/src/components/stats/ProfileStatCell.astro`
- Create: `app/src/components/stats/ProfileMetricCard.astro`
- Create: `app/src/components/stats/ProfileStatsSection.astro`
- Create: `app/tests/pages/home-stats-assembly.test.ts`

**Frontend-design:** Pub scoreboard hierarchy — label whispers, number shouts. Mono for numbers only.

- [ ] **Step 1:** `StatsSectionHeader.astro`

```astro
---
interface Props {
  title: string;
  href?: string;
}
const { title, href } = Astro.props;
---
<div class="flex items-center justify-between gap-4">
  {href ? (
    <a href={href} class="font-display shrink-0 text-2xl uppercase tracking-wide text-muted-foreground">
      {title}
    </a>
  ) : (
    <h2 class="font-display shrink-0 text-2xl uppercase tracking-wide text-muted-foreground">
      {title}
    </h2>
  )}
  <div class="bg-border/40 w-full pt-px"></div>
</div>
```

- [ ] **Step 2:** `ProfileStatCell.astro`

```astro
---
interface Props {
  value: string;
  label: string;
}
const { value, label } = Astro.props;
---
<div class="flex w-full flex-col items-start justify-center">
  <span class="text-foreground font-mono font-bold">{value}</span>
  <span class="text-muted-foreground shrink-0 text-xs tracking-wider uppercase">{label}</span>
</div>
```

- [ ] **Step 3:** `ProfileMetricCard.astro`

```astro
---
import type { MetricKind } from "@lib/shared/stats";

interface Props {
  label: string;
  value: string;
  metricKind: MetricKind;
  chartToken: "chart-1" | "chart-2" | "chart-3";
  showChart: boolean;
}

const { label, value, metricKind, chartToken, showChart } = Astro.props;
---
<article
  class="card-metric-liquid w-full"
  data-metric-kind={metricKind}
  data-chart-token={chartToken}
  data-show-chart={showChart ? "true" : "false"}
>
  {showChart && <canvas class="card-metric-liquid-canvas" aria-hidden="true"></canvas>}
  <div class="card-metric-liquid-scrim" aria-hidden="true"></div>
  <div class="card-metric-liquid-content">
    <span class="text-muted-foreground/80 text-xs tracking-wider uppercase">{label}</span>
    <span class="text-foreground font-mono text-xl font-bold">{value}</span>
  </div>
</article>
```

- [ ] **Step 4:** `ProfileStatsSection.astro`

```astro
---
import StatsSectionHeader from "./StatsSectionHeader.astro";
import ProfileStatCell from "./ProfileStatCell.astro";
import ProfileMetricCard from "./ProfileMetricCard.astro";
import {
  formatThreeDartAverage,
  formatScoringAverage,
  formatCheckoutPercentage,
  type ProfileDashboardData,
} from "@lib/shared/stats";

interface Props {
  displayName: string;
  dashboard: ProfileDashboardData;
}

const { displayName, dashboard } = Astro.props;
const sparklinesJson = JSON.stringify(dashboard.sparklines).replace(/</g, "\\u003c");

const metricCards = [
  {
    label: "3 dart avg.",
    value: formatThreeDartAverage(dashboard.metrics.threeDartAverage),
    kind: "threeDartAverage" as const,
    token: "chart-1" as const,
    series: dashboard.sparklines.find((s) => s.kind === "threeDartAverage"),
  },
  {
    label: "Scoring avg.",
    value: formatScoringAverage(dashboard.metrics.scoringAverage),
    kind: "scoringAverage" as const,
    token: "chart-2" as const,
    series: dashboard.sparklines.find((s) => s.kind === "scoringAverage"),
  },
  {
    label: "Checkout rate",
    value: formatCheckoutPercentage(dashboard.metrics.checkoutPercentage),
    kind: "checkoutPercentage" as const,
    token: "chart-3" as const,
    series: dashboard.sparklines.find((s) => s.kind === "checkoutPercentage"),
  },
];
---
<section
  class="grid grid-cols-2 gap-x-4 gap-y-6"
  x-data="homeStats()"
  data-sparklines={sparklinesJson}
>
  <article class="col-span-2 space-y-2">
    <StatsSectionHeader title="Statistics" href="/statistics" />
  </article>

  <article class="col-span-2 flex flex-col gap-y-4">
    <div>
      <span class="text-muted-foreground shrink-0 text-xs tracking-wider uppercase">Nickname</span>
      <h3 class="text-foreground font-bold">{displayName}</h3>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <ProfileStatCell value={String(dashboard.gamesPlayed)} label="Games Played" />
      <ProfileStatCell value={String(dashboard.gamesWon)} label="Games won" />
    </div>

    <div class="grid grid-cols-2 gap-4">
      {metricCards.map((card) => (
        <ProfileMetricCard
          label={card.label}
          value={card.value}
          metricKind={card.kind}
          chartToken={card.token}
          showChart={(card.series?.points.length ?? 0) >= 2}
        />
      ))}
    </div>
  </article>
</section>
```

- [ ] **Step 5: Assembly test**

```ts
// tests/pages/home-stats-assembly.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readSource(rel: string) {
  return readFileSync(path.resolve(process.cwd(), rel), 'utf8');
}

describe('homepage stats assembly', () => {
  it('wires ProfileStatsSection and dashboard fetch', () => {
    const index = readSource('src/pages/index.astro');
    expect(index).toContain('ProfileStatsSection');
    expect(index).toContain('getProfileDashboardData');
    expect(index).toContain('getPreferences');
  });

  it('ProfileMetricCard uses liquid layers', () => {
    const card = readSource('src/components/stats/ProfileMetricCard.astro');
    expect(card).toContain('card-metric-liquid');
    expect(card).toContain('card-metric-liquid-canvas');
    expect(card).toContain('card-metric-liquid-scrim');
  });
});
```

- [ ] **Step 6: Commit**

```bash
git add src/components/stats/ tests/pages/home-stats-assembly.test.ts
git commit -m "feat(ui): add reusable homepage stats components"
```

---

### Task 11: Chart.js client utilities

**Files:**

- Create: `app/src/lib/client/charts/chart-theme.ts`
- Create: `app/src/lib/client/charts/sparkline.ts`
- Create: `app/src/lib/client/alpine/home-stats.ts`
- Modify: `app/src/lib/client/alpine/app.factory.ts`
- Create: `app/tests/lib/client/charts/sparkline.test.ts` (unit test color parser + empty points guard)

- [ ] **Step 1:** `chart-theme.ts`

```ts
export function readChartColor(
  token: 'chart-1' | 'chart-2' | 'chart-3',
): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  return raw ? `hsl(${raw})` : 'hsl(248 100% 66%)';
}

export function withAlpha(hslColor: string, alpha: number): string {
  return hslColor.replace('hsl(', 'hsla(').replace(')', ` / ${alpha})`);
}
```

- [ ] **Step 2:** `sparkline.ts`

```ts
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
} from 'chart.js';
import type { SparklinePoint } from '@lib/shared/stats';
import { readChartColor, withAlpha } from './chart-theme';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
);

export function createSparkline(
  canvas: HTMLCanvasElement,
  points: SparklinePoint[],
  token: 'chart-1' | 'chart-2' | 'chart-3',
): Chart {
  const color = readChartColor(token);
  const labels = points.map((p) => p.x);
  const data = points.map((p) => p.y);

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data,
          borderColor: withAlpha(color, 0.65),
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            const g = chart.ctx.createLinearGradient(0, 0, 0, chart.height);
            g.addColorStop(0, withAlpha(color, 0.12));
            g.addColorStop(1, withAlpha(color, 0));
            return g;
          },
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  });
}

export function destroySparkline(chart: Chart | undefined): void {
  chart?.destroy();
}
```

- [ ] **Step 3:** `home-stats.ts`

```ts
import type { Alpine } from 'alpinejs';
import type { SparklineSeries } from '@lib/shared/stats';
import {
  createSparkline,
  destroySparkline,
} from '@lib/client/charts/sparkline';
import type { Chart } from 'chart.js';

export function homeStats() {
  const charts = new Map<string, Chart>();

  return {
    init() {
      const root = this.$el as HTMLElement;
      const raw = root.dataset.sparklines;
      if (!raw) return;

      let series: SparklineSeries[] = [];
      try {
        series = JSON.parse(raw) as SparklineSeries[];
      } catch {
        return;
      }

      const cards = root.querySelectorAll<HTMLElement>('[data-metric-kind]');
      for (const card of cards) {
        if (card.dataset.showChart !== 'true') continue;
        const kind = card.dataset.metricKind;
        const token = card.dataset.chartToken as
          | 'chart-1'
          | 'chart-2'
          | 'chart-3';
        const canvas = card.querySelector('canvas');
        const match = series.find((s) => s.kind === kind);
        if (!canvas || !match || match.points.length < 2) continue;

        const chart = createSparkline(canvas, match.points, token);
        charts.set(kind ?? '', chart);
      }
    },

    destroy() {
      for (const chart of charts.values()) destroySparkline(chart);
      charts.clear();
    },
  };
}

export function registerHomeStats(Alpine: Alpine): void {
  Alpine.data('homeStats', homeStats);
}
```

- [ ] **Step 4: Register in** `app.factory.ts`

```ts
import { registerHomeStats } from '@lib/client/alpine/home-stats';
// inside default export:
registerHomeStats(Alpine);
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(client): add Chart.js sparkline hydration for homepage"
```

---

### Task 12: Wire homepage (`index.astro`)

**Files:**

- Modify: `app/src/pages/index.astro`

- [ ] **Step 1: Replace static block**

```astro
---
import ProfileStatsSection from "@components/stats/ProfileStatsSection.astro";
import { getPreferences } from "@lib/server/data/preferences";
import { getProfileDashboardData } from "@lib/server/data/player-stat-completions";

const session = Astro.locals.session!;
let displayName = "You";
let dashboard = {
  metrics: { threeDartAverage: null, scoringAverage: null, checkoutPercentage: null },
  sparklines: [],
  gamesPlayed: 0,
  gamesWon: 0,
};

if (session.userId) {
  try {
    const preferences = await getPreferences(session.userId);
    displayName = preferences.displayName?.trim() || displayName;
    dashboard = await getProfileDashboardData(session.userId);
  } catch {
    /* graceful fallback — spec §9 */
  }
}
---

<AppLayout>
  <main class="mx-auto w-full max-w-2xl space-y-6 p-4 @sm:p-6">
    <ProfileStatsSection displayName={displayName} dashboard={dashboard} />
  </main>
</AppLayout>
```

- [ ] **Step 2: Run verification gate commands**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(home): show live player statistics with liquid metric cards"
```

---

### Task 13: Emil design-eng review — new components

**REQUIRED SUB-SKILL:** `emil-design-eng`
Review each new component/CSS against current theme. Apply fixes inline before marking done.

| Component                  | Before                                    | After                                                           | Why                                                                   |
| -------------------------- | ----------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `ProfileMetricCard`        | Chart canvas could capture pointer events | `pointer-events-none` on canvas + scrim                         | Background chart must not block taps on future linked cards           |
| `card-metric-liquid`       | Missing explicit min-height on content    | `min-h-28` on card + content                                    | Prevents layout collapse before Chart.js paints                       |
| `home-stats` Chart.js      | Default animations on                     | `animation: false`                                              | Homepage seen often; motion adds no information (Emil frequency rule) |
| `ProfileStatsSection` link | Default anchor underline                  | `no-underline` + existing `link-subtle` hover if styled as link | Section header should not look like body link                         |
| `card-metric-liquid-scrim` | Flat 50% overlay                          | Directional gradient 88% → 15%                                  | iOS liquid: text corner readable, chart visible at opposite corner    |
| Sparkline                  | `transition: all` (if any)                | No transitions on chart container                               | Chart updates are SSR navigation — avoid jank                         |
| Global                     | No `prefers-reduced-motion` for charts    | Charts are static lines — no entry animation needed             | Already satisfied if `animation: false`                               |

- [ ] **Step 1: Walk each row; patch files if any "Before" still true.**

- [ ] **Step 2: Visual smoke** — `npm run dev`, open `/`, confirm:
  - 2-column grid at mobile width
  - Text readable over chart
  - No flash of unstyled chart before Alpine init (`x-cloak` not needed — SSR values visible without JS)

- [ ] **Step 3: Commit design fixes**

```bash
git commit -m "style(stats): emil pass on liquid metric cards"
```

---

## Spec Coverage Self-Review

| Spec section                | Task                                        |
| --------------------------- | ------------------------------------------- |
| §4 Data model               | Task 2                                      |
| §3 Metrics                  | Tasks 4, 6                                  |
| §5 Completion pipeline      | Tasks 5, 8                                  |
| §6 Sparklines               | Task 4, 7                                   |
| §7 Homepage UI              | Tasks 9, 10, 11, 12                         |
| §7.5 Chart.js               | Task 11                                     |
| §9 Error handling           | Tasks 7, 12 (try/catch)                     |
| §10 Testing                 | All test steps                              |
| §11 Verification            | Final gate                                  |
| §8 Statistics page deferred | Not in plan (data columns only)             |
| §6.4 Month delta            | Task 4 (`computeMonthDelta`, not displayed) |
| ESLint stats barrel         | Already configured                          |

**Placeholder scan:** None.

---

## Execution Handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-06-30-player-statistics.md`**.**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
**2. Inline Execution** — run tasks in this session with checkpoints

Which approach?
