// Domain types
export type {
  TenUpOneDownCompletionReason,
  TenUpOneDownGameState,
  TenUpOneDownGameStatus,
  TenUpOneDownRoundRecord,
  TenUpOneDownSession,
  TenUpOneDownSettings,
  TenUpOneDownSummary,
} from "./types";

// Result types (co-located with logic)
export type { ValidateCompletedTenUpOneDownResult } from "./completion";
export type { ValidateSettingsResult } from "./validation";

// Constants
export {
  DARTS_PER_ROUND,
  DEFAULT_PLAYTIME_SECONDS,
  DEFAULT_ROUND_COUNT,
  FAILURE_DELTA,
  MAX_PLAYTIME_SECONDS,
  MAX_ROUND_COUNT,
  MAX_TARGET,
  MIN_PLAYTIME_SECONDS,
  MIN_ROUND_COUNT,
  MIN_TARGET,
  STARTING_TARGET,
  SUCCESS_DELTA,
} from "./constants";

// Session
export { buildTenUpOneDownSession } from "./session-factory";
export { isTenUpOneDownSession } from "./session";

// Settings & form
export { parseTenUpOneDownSettingsFormData } from "./form-data";
export { validateTenUpOneDownSettings } from "./validation";

// Gameplay
export { applyRoundToState, revertRoundFromState } from "./state";
export { buildRoundRecord, validateRoundRecord } from "./round";
export { resolveRoundOutcome } from "./outcome";

// Completion & summary
export { validateCompletedTenUpOneDownSession } from "./completion";
export { buildSummary } from "./summary";

// Stats
export { applyGameCompletionToStats } from "./stats";
