// Domain types
export type {
  DartOutcome,
  DartOutcomeType,
  DartRecord,
  SegmentCounts,
  SinglesTrainingDirection,
  SinglesTrainingGameState,
  SinglesTrainingGameStatus,
  SinglesTrainingMode,
  SinglesTrainingScoring,
  SinglesTrainingSession,
  SinglesTrainingSettings,
  SinglesTrainingSummary,
  SinglesTrainingTarget,
} from "./types";

// Result types (co-located with logic)
export type { ValidateCompletedSinglesTrainingResult } from "./completion";
export type { ValidateSettingsResult } from "./validation";

// Constants
export {
  DARTS_PER_VISIT,
  DEFAULT_DIRECTION,
  DEFAULT_MODE,
  DEFAULT_SCORING,
  TARGET_COUNT,
} from "./constants";

// Session
export { buildSinglesTrainingSession } from "./session-factory";
export { isSinglesTrainingSession } from "./session";

// Settings & form
export { parseSinglesTrainingSettingsFormData } from "./form-data";
export { validateSinglesTrainingSettings } from "./validation";

// Gameplay
export { applyDartToSession, revertLastDart } from "./state";
export { formatDartOutcomeLabel, isValidOutcomeForTarget } from "./dart";

// Completion & summary
export { validateCompletedSinglesTrainingSession } from "./completion";
export { buildSummary } from "./summary";

// Stats
export {
  applyGameCompletionToStats,
  createEmptySinglesTrainingStats,
} from "./stats";
export type { PlayerSinglesTrainingStats } from "./stats";
