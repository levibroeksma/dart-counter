// Domain types
export type {
  FiveOhOneBotState,
  FiveOhOneDartbotPlayer,
  FiveOhOneGameState,
  FiveOhOneGameStatus,
  FiveOhOneMatchMode,
  FiveOhOnePhase,
  FiveOhOnePlayer,
  FiveOhOnePlayerState,
  FiveOhOneSession,
  FiveOhOneSettings,
  FiveOhOneSummary,
  FiveOhOneUnit,
  FiveOhOneUserOrGuestPlayer,
  FiveOhOneVisitRecord,
  Player501Stats,
  VisitClassification,
} from "./types";

// Result types (co-located with logic)
export type { ValidateCompletedFiveOhOneResult } from "./completion";
export type { ValidateSettingsResult, ValidateVisitScoreResult } from "./validation";

// Constants
export {
  DARTS_PER_VISIT,
  LEGS_PER_SET,
  MAX_TARGET_COUNT_LEGS,
  MAX_TARGET_COUNT_SETS,
  MAX_VISIT_SCORE,
  MIN_TARGET_COUNT_LEGS,
  MIN_TARGET_COUNT_SETS,
  MIN_VISIT_SCORE,
  STARTING_SCORE,
} from "./constants";

// Session
export { buildFiveOhOneSession } from "./session-factory";
export { isFiveOhOneSession } from "./session";

// Settings & form
export { parseFiveOhOneSettingsFormData } from "./form-data";
export { validateFiveOhOneSettings, validateVisitScore } from "./validation";

// Gameplay
export { applyVisit, revertLastOpponentPair, revertLastVisit } from "./state";
export {
  resolve501CheckoutModal,
  type CheckoutModalKind,
  type Resolved501CheckoutModal,
} from "./checkout-modal";
export { deriveBotVisitDartMetadata } from "./bot-dart-metadata";
export { format501PlayerDisplayName } from "./display";

// DartBot glue
export {
  canUndoDartBotPair,
  getOpponentPlayer,
  isDartBotSession,
  isDartBotTurn,
  lastTwoVisitsAreUserThenDartBot,
} from "./bot-helpers";
export {
  isMatchWinningCheckoutPossible,
  simulateDartBotVisitForSession,
} from "./bot-play";

// Completion & summary
export { validateCompletedFiveOhOneSession } from "./completion";
export { buildMatchFormatLabel, buildSummary } from "./summary";

// Stats
export { applyGameCompletionToStats, createEmpty501Stats } from "./stats";
