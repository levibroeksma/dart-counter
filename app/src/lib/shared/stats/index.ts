// Domain types
export type {
  MetricKind,
  PlayerDartStats,
  ProfileMetricValue,
  ProfileMetrics,
  SparklinePoint,
  SparklineSeries,
  StatCompletionRecord,
  VisitMilestoneCounts,
} from "./types";

// Double stats
export {
  applyRoundToStats,
  createEmptyPlayerDartStats,
  revertRoundFromStats,
} from "./double-stats";

// Visit milestones
export { countVisitMilestones } from "./milestones";

// Completion snapshots
export {
  build501CompletionSnapshot,
  buildScoreTrainingCompletionSnapshot,
  buildTenUpOneDownCompletionSnapshot,
  buildSinglesTrainingCompletionSnapshot,
  type CompletionSnapshotInsert,
} from "./completion-snapshot";

// Profile metrics
export {
  computeProfileMetrics,
  computeSparklineSeries,
  computeMonthDelta,
  type MonthDelta,
} from "./profile-metrics";
