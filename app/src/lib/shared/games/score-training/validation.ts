import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  MIN_ROUND_COUNT, MAX_ROUND_COUNT,
  MIN_PLAYTIME_SECONDS, MAX_PLAYTIME_SECONDS,
  MIN_VISIT_SCORE, MAX_VISIT_SCORE,
} from "@lib/shared/games/score-training/constants";
import type { ScoreTrainingSettings } from "@lib/shared/games/score-training/settings";

export type ValidateSettingsResult =
  | { valid: true; value: ScoreTrainingSettings }
  | { valid: false; code: typeof MessageCode.INVALID_GAME_SETTINGS };

export type ValidateVisitScoreResult =
  | { valid: true; value: number }
  | { valid: false; code: typeof MessageCode.INVALID_SCORE };

export function validateScoreTrainingSettings(
  raw: Record<string, unknown>
): ValidateSettingsResult {
  const endMode = raw.endMode;
  if (endMode === "rounds") {
    const roundCount = Number(raw.roundCount);
    if (!Number.isInteger(roundCount) || roundCount < MIN_ROUND_COUNT || roundCount > MAX_ROUND_COUNT) {
      return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
    }
    return { valid: true, value: { endMode: "rounds", roundCount } };
  }
  if (endMode === "timed") {
    const playtimeSeconds = Number(raw.playtimeSeconds);
    if (!Number.isInteger(playtimeSeconds) || playtimeSeconds < MIN_PLAYTIME_SECONDS || playtimeSeconds > MAX_PLAYTIME_SECONDS) {
      return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
    }
    return { valid: true, value: { endMode: "timed", playtimeSeconds } };
  }
  return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
}

export function validateVisitScore(value: unknown): ValidateVisitScoreResult {
  const score = Number(value);
  if (!Number.isInteger(score) || score < MIN_VISIT_SCORE || score > MAX_VISIT_SCORE) {
    return { valid: false, code: MessageCode.INVALID_SCORE };
  }
  return { valid: true, value: score };
}
