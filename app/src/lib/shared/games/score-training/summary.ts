import { DARTS_PER_VISIT } from "./constants";
import type { ScoreTrainingSession, ScoreTrainingSummary } from "./types";

export function buildSummary(session: ScoreTrainingSession): ScoreTrainingSummary {
  const roundsPlayed = session.roundHistory.length;
  const totalScore = session.state.currentScore;
  return {
    totalScore,
    threeDartAverage: roundsPlayed > 0 ? totalScore / roundsPlayed : 0,
    roundsPlayed,
    dartsThrown: roundsPlayed * DARTS_PER_VISIT,
  };
}
