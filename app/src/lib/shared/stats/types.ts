export type PlayerDartStats = {
  doubleAttempts: number;
  doubleHits: number;
  totalCheckouts: number;
  totalCheckoutDarts: number;
};

export type MetricKind =
  | "threeDartAverage"
  | "scoringAverage"
  | "checkoutPercentage";

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
