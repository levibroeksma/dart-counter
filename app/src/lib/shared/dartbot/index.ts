export type {
  BotCheckoutRoute,
  BullSetupOutcomes,
  ConvergenceBias,
  ConvergenceConfig,
  DeviationBand,
  DoubleOutcomes,
  LevelProfile,
  MatchPlan,
  MatchStats,
  Rng,
  ScoringOutcomes,
  Segment,
  SegmentLabel,
  SetRunningStats,
  SetupOutcomes,
  SimulatedDart,
  SimulatedVisit,
  SimulateVisitContext,
  SkillProfile,
  StatRange,
  StatsValidation,
  ThrowIntent,
} from "./types";

export { createEmptySetRunningStats } from "./types";

export { simulateVisit } from "./dart-bot";
export {
  ANCHOR_PROFILES,
  LEVEL_STAT_RANGES,
  getSkillProfile,
} from "./levels";
export {
  formatDartbotLevelPreview,
  type DartbotLevelPreview,
} from "./preview";
export { generateMatchPlan } from "./match-planner";
export { createRng, hashSeed } from "./rng";
export { validateMatchStats } from "./statistics-engine";
export { isWithinStatBand } from "./stat-validation";
export { boardNeighbors, parseSegment, scoreForSegment } from "./segments";
