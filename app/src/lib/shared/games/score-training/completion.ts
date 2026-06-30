import { MessageCode } from "@lib/shared/constants/errors.constants";
import { STARTING_SCORE } from "./constants";
import { validateRoundRecord } from "./round";
import { isScoreTrainingSession } from "./session";
import type { ScoreTrainingSession } from "./types";
import { validateScoreTrainingSettings } from "./validation";

export type ValidateCompletedScoreTrainingResult =
  | { valid: true; value: ScoreTrainingSession }
  | {
      valid: false;
      code:
        | typeof MessageCode.INVALID_GAME_SETTINGS
        | typeof MessageCode.GAME_NOT_COMPLETE
        | typeof MessageCode.INVALID_ROUND;
    };

/**
 * Validates a client-submitted completed score-training session.
 */
export function validateCompletedScoreTrainingSession(
  raw: unknown,
): ValidateCompletedScoreTrainingResult {
  if (!isScoreTrainingSession(raw)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  const session = raw;
  const settingsCheck = validateScoreTrainingSettings(
    session.settings as unknown as Record<string, unknown>,
  );
  if (!settingsCheck.valid) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  if (session.state.status !== "completed") {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  let expectedRound = 1;
  let runningTotal = STARTING_SCORE;

  for (const round of session.roundHistory) {
    const roundCheck = validateRoundRecord(round, expectedRound);
    if (!roundCheck.valid) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }

    runningTotal += round.visitScore;
    if (round.runningTotal !== runningTotal) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }

    expectedRound += 1;
  }

  if (session.state.currentRound !== expectedRound) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }

  if (session.state.currentScore !== runningTotal) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }

  const lastRound = session.roundHistory[session.roundHistory.length - 1];
  if (session.state.lastScore !== (lastRound?.visitScore ?? null)) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }

  if (settingsCheck.value.endMode === "rounds") {
    if (session.roundHistory.length !== settingsCheck.value.roundCount) {
      return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
    }
  }

  return { valid: true, value: session };
}
