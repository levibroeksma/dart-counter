import { DARTS_PER_VISIT, TARGET_COUNT } from "@lib/shared/games/singles-training/constants";
import {
  buildDartRecord,
  isHit,
  type DartOutcome,
} from "@lib/shared/games/singles-training/dart";
import type { SinglesTrainingMode } from "@lib/shared/games/singles-training/settings";
import {
  createEmptySegmentCounts,
  type SinglesTrainingGameState,
  type SinglesTrainingSession,
} from "@lib/shared/games/singles-training/session";

export function getMinimumHitsForMode(mode: SinglesTrainingMode): number {
  if (mode === "hard") return 1;
  if (mode === "extreme") return 2;
  return 0;
}

export function createInitialGameState(): SinglesTrainingGameState {
  return {
    status: "active",
    currentTargetIndex: 0,
    currentDartInVisit: 0,
    score: 0,
    segmentCounts: createEmptySegmentCounts(),
  };
}

function countHitsInCurrentVisit(session: SinglesTrainingSession): number {
  const { currentTargetIndex } = session.state;
  return session.dartHistory.filter(
    (d) => d.targetIndex === currentTargetIndex && isHit(d.outcome),
  ).length;
}

function advanceAfterVisit(session: SinglesTrainingSession): SinglesTrainingSession {
  const nextTargetIndex = session.state.currentTargetIndex + 1;
  if (nextTargetIndex >= TARGET_COUNT) {
    return {
      ...session,
      state: { ...session.state, status: "completed", currentDartInVisit: 0 },
    };
  }
  return {
    ...session,
    state: {
      ...session.state,
      currentTargetIndex: nextTargetIndex,
      currentDartInVisit: 0,
    },
  };
}

export function applyDartToSession(
  session: SinglesTrainingSession,
  outcome: DartOutcome,
): SinglesTrainingSession {
  const { currentTargetIndex, currentDartInVisit } = session.state;
  const dartInVisit = currentDartInVisit as 0 | 1 | 2;
  const record = buildDartRecord(
    currentTargetIndex,
    dartInVisit,
    outcome,
    session.settings.scoring,
  );

  const segmentCounts = { ...session.state.segmentCounts };
  segmentCounts[record.outcome.type] += 1;

  let next: SinglesTrainingSession = {
    ...session,
    dartHistory: [...session.dartHistory, record],
    state: {
      ...session.state,
      score: session.state.score + record.points,
      segmentCounts,
      currentDartInVisit: ((currentDartInVisit + 1) % DARTS_PER_VISIT) as 0 | 1 | 2,
    },
  };

  const visitComplete = currentDartInVisit === DARTS_PER_VISIT - 1;
  if (!visitComplete) return next;

  const hits = countHitsInCurrentVisit(next);
  const minimum = getMinimumHitsForMode(next.settings.mode);
  if (hits < minimum) {
    return { ...next, state: { ...next.state, status: "dead" } };
  }

  return advanceAfterVisit(next);
}

export function revertLastDart(session: SinglesTrainingSession): SinglesTrainingSession {
  if (session.dartHistory.length === 0) return session;

  const removed = session.dartHistory[session.dartHistory.length - 1];
  const dartHistory = session.dartHistory.slice(0, -1);
  const segmentCounts = { ...session.state.segmentCounts };
  segmentCounts[removed.outcome.type] -= 1;

  return {
    ...session,
    dartHistory,
    state: {
      status: "active",
      currentTargetIndex: removed.targetIndex,
      currentDartInVisit: removed.dartInVisit,
      score: session.state.score - removed.points,
      segmentCounts,
    },
  };
}
