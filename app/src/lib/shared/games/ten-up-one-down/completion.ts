import { MessageCode } from "@lib/shared/constants/errors.constants";
import { MAX_TARGET } from "./constants";
import { validateRoundRecord } from "./round";
import { isTenUpOneDownSession } from "./session";
import { createInitialGameState, applyRoundToState } from "./state";
import type { TenUpOneDownSession } from "./types";
import { validateTenUpOneDownSettings } from "./validation";

export type ValidateCompletedTenUpOneDownResult =
  | { valid: true; value: TenUpOneDownSession }
  | {
      valid: false;
      code:
        | typeof MessageCode.INVALID_GAME_SETTINGS
        | typeof MessageCode.GAME_NOT_COMPLETE
        | typeof MessageCode.INVALID_ROUND;
    };

/**
 * Validates a client-submitted completed ten-up-one-down session.
 */
export function validateCompletedTenUpOneDownSession(
  raw: unknown,
): ValidateCompletedTenUpOneDownResult {
  if (!isTenUpOneDownSession(raw)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  const session = raw;
  const settingsCheck = validateTenUpOneDownSettings(
    session.settings as unknown as Record<string, unknown>,
  );
  if (!settingsCheck.valid) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  if (session.state.status !== "completed") {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  if (session.roundHistory.length < 1) {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  let replayState = createInitialGameState(settingsCheck.value);

  for (const round of session.roundHistory) {
    if (round.roundNumber !== replayState.currentRound) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }
    if (round.targetAtStart !== replayState.currentTarget) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }

    const roundCheck = validateRoundRecord(round);
    if (!roundCheck.valid) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }

    const roundCopy = { ...round };
    replayState = applyRoundToState(replayState, roundCopy, settingsCheck.value);
    if (roundCopy.targetAfter !== round.targetAfter) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }
  }

  if (
    replayState.currentRound !== session.state.currentRound ||
    replayState.currentTarget !== session.state.currentTarget ||
    replayState.status !== session.state.status
  ) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }

  const lastRound = session.roundHistory[session.roundHistory.length - 1]!;
  const completedOn170 =
    lastRound.finished && lastRound.targetAtStart === MAX_TARGET;

  if (settingsCheck.value.endMode === "rounds") {
    if (
      !completedOn170 &&
      session.roundHistory.length !== settingsCheck.value.roundCount
    ) {
      return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
    }
  } else if (!completedOn170) {
    if (
      session.timeRemainingSeconds === null ||
      session.timeRemainingSeconds > 0
    ) {
      return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
    }
  }

  return { valid: true, value: session };
}
