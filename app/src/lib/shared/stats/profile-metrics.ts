import type {
  MetricKind,
  ProfileMetrics,
  SparklinePoint,
  SparklineSeries,
  StatCompletionRecord,
} from "./types";

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
  if (kind === "threeDartAverage") return threeDartFromRows(rows);
  if (kind === "scoringAverage") return scoringFromRows(rows);
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
