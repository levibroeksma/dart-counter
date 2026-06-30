import { DARTS_PER_VISIT } from "./constants";
import { isHit } from "./dart";
import type { SinglesTrainingSession, SinglesTrainingSummary } from "./types";

export type { SinglesTrainingSummary } from "./types";

export function buildSummary(session: SinglesTrainingSession): SinglesTrainingSummary {
  const dartsThrown = session.dartHistory.length;
  const hits = session.dartHistory.filter((d) => isHit(d.outcome)).length;
  const hitRatio = dartsThrown === 0 ? 0 : hits / dartsThrown;

  const positionHits: [number, number, number] = [0, 0, 0];
  const positionAttempts: [number, number, number] = [0, 0, 0];

  for (const dart of session.dartHistory) {
    positionAttempts[dart.dartInVisit] += 1;
    if (isHit(dart.outcome)) positionHits[dart.dartInVisit] += 1;
  }

  const dartPositionSuccessRates: [number, number, number] = [0, 1, 2].map((i) =>
    positionAttempts[i] === 0 ? 0 : positionHits[i] / positionAttempts[i],
  ) as [number, number, number];

  const targetsCompleted =
    session.state.status === "completed"
      ? session.targetSequence.length
      : Math.floor(dartsThrown / DARTS_PER_VISIT);

  return {
    status: session.state.status === "dead" ? "dead" : "completed",
    score: session.state.score,
    segmentCounts: session.state.segmentCounts,
    hitRatio,
    dartPositionSuccessRates,
    targetsCompleted,
    dartsThrown,
  };
}
