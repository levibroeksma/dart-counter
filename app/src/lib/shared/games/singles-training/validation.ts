import { MessageCode } from "@lib/shared/constants/errors.constants";
import type {
  SinglesTrainingDirection,
  SinglesTrainingMode,
  SinglesTrainingScoring,
  SinglesTrainingSettings,
} from "@lib/shared/games/singles-training/settings";
import {
  DEFAULT_DIRECTION,
  DEFAULT_MODE,
  DEFAULT_SCORING,
} from "@lib/shared/games/singles-training/constants";

const DIRECTIONS: SinglesTrainingDirection[] = ["low-to-high", "high-to-low", "random"];
const MODES: SinglesTrainingMode[] = ["normal", "hard", "extreme"];
const SCORINGS: SinglesTrainingScoring[] = ["traditional", "uniform"];

export type ValidateSettingsResult =
  | { valid: true; value: SinglesTrainingSettings }
  | { valid: false; code: typeof MessageCode.INVALID_GAME_SETTINGS };

export function validateSinglesTrainingSettings(
  raw: Record<string, unknown>,
): ValidateSettingsResult {
  const direction = raw.direction ?? DEFAULT_DIRECTION;
  const mode = raw.mode ?? DEFAULT_MODE;
  const scoring = raw.scoring ?? DEFAULT_SCORING;

  if (!DIRECTIONS.includes(direction as SinglesTrainingDirection)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }
  if (!MODES.includes(mode as SinglesTrainingMode)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }
  if (!SCORINGS.includes(scoring as SinglesTrainingScoring)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  return {
    valid: true,
    value: {
      direction: direction as SinglesTrainingDirection,
      mode: mode as SinglesTrainingMode,
      scoring: scoring as SinglesTrainingScoring,
    },
  };
}
