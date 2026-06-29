import { MessageCode } from "@lib/shared/constants/errors.constants";
import { buildFiveOhOneSession } from "@lib/shared/games/501/session-factory";
import {
  isFiveOhOneSession,
  type FiveOhOneGameState,
  type FiveOhOneSession,
  type FiveOhOneVisitRecord,
} from "@lib/shared/games/501/session";
import { applyVisit } from "@lib/shared/games/501/state";
import {
  validateFiveOhOneSettings,
  validateVisitScore,
} from "@lib/shared/games/501/validation";

export type ValidateCompletedFiveOhOneResult =
  | { valid: true; value: FiveOhOneSession }
  | {
      valid: false;
      code:
        | typeof MessageCode.INVALID_GAME_SETTINGS
        | typeof MessageCode.GAME_NOT_COMPLETE
        | typeof MessageCode.INVALID_SCORE;
    };

function statesMatch(a: FiveOhOneGameState, b: FiveOhOneGameState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function visitsMatch(a: FiveOhOneVisitRecord, b: FiveOhOneVisitRecord): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Validates a client-submitted completed 501 session by replaying all visits.
 */
export function validateCompletedFiveOhOneSession(
  raw: unknown,
): ValidateCompletedFiveOhOneResult {
  if (!isFiveOhOneSession(raw)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  const session = raw;
  const settingsCheck = validateFiveOhOneSettings(
    session.settings as unknown as Record<string, unknown>,
  );
  if (!settingsCheck.valid) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  if (session.state.status !== "completed") {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  if (session.visitHistory.length === 0) {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  const firstVisit = session.visitHistory[0];
  const startingPlayerId = firstVisit?.playerId;
  if (!startingPlayerId) {
    return { valid: false, code: MessageCode.INVALID_SCORE };
  }

  let replayed = buildFiveOhOneSession(settingsCheck.value, startingPlayerId);

  for (let index = 0; index < session.visitHistory.length; index += 1) {
    const submittedVisit = session.visitHistory[index]!;
    const scoreCheck = validateVisitScore(submittedVisit.visitScore);
    if (!scoreCheck.valid) {
      return { valid: false, code: MessageCode.INVALID_SCORE };
    }

    if (replayed.state.currentPlayerId !== submittedVisit.playerId) {
      return { valid: false, code: MessageCode.INVALID_SCORE };
    }

    replayed = applyVisit(replayed, submittedVisit.visitScore);
    const expectedVisit = replayed.visitHistory[index];
    if (!expectedVisit || !visitsMatch(expectedVisit, submittedVisit)) {
      return { valid: false, code: MessageCode.INVALID_SCORE };
    }
  }

  if (replayed.state.status !== "completed") {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  if (!statesMatch(replayed.state, session.state)) {
    return { valid: false, code: MessageCode.INVALID_SCORE };
  }

  return { valid: true, value: session };
}
