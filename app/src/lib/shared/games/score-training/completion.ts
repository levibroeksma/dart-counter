import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  isScoreTrainingSession,
  type ScoreTrainingSession,
} from "@lib/shared/games/score-training/session";
import { validateRoundRecord } from "@lib/shared/games/score-training/round";
import { validateScoreTrainingSettings } from "@lib/shared/games/score-training/validation";
import { STARTING_SCORE } from "@lib/shared/games/score-training/constants";

export type ValidateCompletedResult =
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
): ValidateCompletedResult {
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
