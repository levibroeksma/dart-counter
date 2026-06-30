// Domain types
export type {
  ScoreTrainingGameState,
  ScoreTrainingGameStatus,
  ScoreTrainingRoundRecord,
  ScoreTrainingSession,
  ScoreTrainingSettings,
  ScoreTrainingSummary,
} from "./types";

// Result types (co-located with logic)
export type { ValidateCompletedScoreTrainingResult } from "./completion";
export type { ValidateSettingsResult } from "./validation";

// Constants
export {
  DARTS_PER_VISIT,
  DEFAULT_PLAYTIME_SECONDS,
  DEFAULT_ROUND_COUNT,
  MAX_PLAYTIME_SECONDS,
  MAX_ROUND_COUNT,
  MAX_VISIT_SCORE,
  MIN_PLAYTIME_SECONDS,
  MIN_ROUND_COUNT,
  MIN_VISIT_SCORE,
  STARTING_SCORE,
} from "./constants";

// Session
export { buildScoreTrainingSession } from "./session-factory";
export { isScoreTrainingSession } from "./session";

// Settings & form
export { parseScoreTrainingSettingsFormData } from "./form-data";
export { validateScoreTrainingSettings } from "./validation";

// Gameplay
export { applyRoundToState, revertRoundFromState } from "./state";
export { buildRoundRecord, validateRoundRecord } from "./round";

// Completion & summary
export { validateCompletedScoreTrainingSession } from "./completion";
export { buildSummary } from "./summary";

// Stats
export {
  applyGameCompletionToStats,
  createEmptyScoreTrainingStats,
} from "./stats";
export type { PlayerScoreTrainingStats } from "./stats";
