import { DARTS_PER_VISIT } from "@lib/shared/games/score-training/constants";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";

export type ScoreTrainingSummary = {
  totalScore: number;
  threeDartAverage: number;
  roundsPlayed: number;
  dartsThrown: number;
};

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
