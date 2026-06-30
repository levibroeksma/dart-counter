import { MessageCode } from "@lib/shared/constants/errors.constants";
import { MAX_VISIT_SCORE, MIN_VISIT_SCORE } from "./constants";
import type { ScoreTrainingRoundRecord } from "./types";

export function buildRoundRecord(
  roundNumber: number,
  visitScore: number,
  currentScore: number,
): ScoreTrainingRoundRecord {
  return { roundNumber, visitScore, runningTotal: currentScore + visitScore };
}

export type ValidateRoundResult =
  | { valid: true }
  | { valid: false; code: typeof MessageCode.INVALID_ROUND | typeof MessageCode.INVALID_SCORE };

export function validateRoundRecord(
  record: ScoreTrainingRoundRecord,
  expectedRoundNumber: number,
): ValidateRoundResult {
  if (record.roundNumber !== expectedRoundNumber) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  if (
    !Number.isInteger(record.visitScore) ||
    record.visitScore < MIN_VISIT_SCORE ||
    record.visitScore > MAX_VISIT_SCORE
  ) {
    return { valid: false, code: MessageCode.INVALID_SCORE };
  }
  return { valid: true };
}
