import { MessageCode } from "@lib/shared/constants/errors.constants";
import { isSinglesTrainingSession } from "./session";
import type { SinglesTrainingSession } from "./types";
import { applyDartToSession, createInitialGameState } from "./state";
import { validateSinglesTrainingSettings } from "./validation";
import { ALL_TARGETS, buildTargetSequence } from "./target-sequence";

export type ValidateCompletedSinglesTrainingResult =
  | { valid: true; value: SinglesTrainingSession }
  | {
      valid: false;
      code:
        | typeof MessageCode.INVALID_GAME_SETTINGS
        | typeof MessageCode.GAME_NOT_COMPLETE
        | typeof MessageCode.INVALID_DART_OUTCOME;
    };

function isValidRandomSequence(sequence: SinglesTrainingSession["targetSequence"]): boolean {
  if (sequence.length !== ALL_TARGETS.length) return false;
  const normalized = sequence.map((t) => String(t)).sort();
  const expected = ALL_TARGETS.map((t) => String(t)).sort();
  return normalized.every((t, i) => t === expected[i]);
}

function isValidTargetSequence(session: SinglesTrainingSession): boolean {
  const { direction } = session.settings;
  if (direction === "random") return isValidRandomSequence(session.targetSequence);
  const expected = buildTargetSequence(direction);
  if (session.targetSequence.length !== expected.length) return false;
  return session.targetSequence.every((t, i) => t === expected[i]);
}

function replaySession(session: SinglesTrainingSession): SinglesTrainingSession {
  let replayed: SinglesTrainingSession = {
    ...session,
    state: createInitialGameState(),
    dartHistory: [],
  };
  for (const dart of session.dartHistory) {
    replayed = applyDartToSession(replayed, dart.outcome);
  }
  return replayed;
}

function statesMatch(
  a: SinglesTrainingSession["state"],
  b: SinglesTrainingSession["state"],
): boolean {
  return (
    a.status === b.status &&
    a.currentTargetIndex === b.currentTargetIndex &&
    a.currentDartInVisit === b.currentDartInVisit &&
    a.score === b.score &&
    a.segmentCounts.miss === b.segmentCounts.miss &&
    a.segmentCounts.single === b.segmentCounts.single &&
    a.segmentCounts.double === b.segmentCounts.double &&
    a.segmentCounts.triple === b.segmentCounts.triple
  );
}

/**
 * Validates a client-submitted terminal singles-training session.
 */
export function validateCompletedSinglesTrainingSession(
  raw: unknown,
): ValidateCompletedSinglesTrainingResult {
  if (!isSinglesTrainingSession(raw)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  const session = raw;
  const settingsCheck = validateSinglesTrainingSettings(
    session.settings as unknown as Record<string, unknown>,
  );
  if (!settingsCheck.valid) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  if (session.state.status !== "dead" && session.state.status !== "completed") {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  if (session.dartHistory.length === 0) {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  if (!isValidTargetSequence(session)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  const replayed = replaySession(session);
  if (!statesMatch(replayed.state, session.state)) {
    return { valid: false, code: MessageCode.INVALID_DART_OUTCOME };
  }

  if (replayed.dartHistory.length !== session.dartHistory.length) {
    return { valid: false, code: MessageCode.INVALID_DART_OUTCOME };
  }

  return { valid: true, value: session };
}
