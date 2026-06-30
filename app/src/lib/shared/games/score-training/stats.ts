import { buildSummary } from "./summary";
import type { ScoreTrainingSession } from "./types";

export type PlayerScoreTrainingStats = {
  gamesCompleted: number;
  totalDartsThrown: number;
  totalPointsScored: number;
  bestVisitScore: number;
  bestGameAverage: number;
};

export function createEmptyScoreTrainingStats(): PlayerScoreTrainingStats {
  return {
    gamesCompleted: 0,
    totalDartsThrown: 0,
    totalPointsScored: 0,
    bestVisitScore: 0,
    bestGameAverage: 0,
  };
}

export function applyGameCompletionToStats(
  stats: PlayerScoreTrainingStats,
  session: ScoreTrainingSession,
): void {
  const summary = buildSummary(session);
  stats.gamesCompleted += 1;
  stats.totalDartsThrown += summary.dartsThrown;
  stats.totalPointsScored += summary.totalScore;

  const bestVisit = session.roundHistory.reduce(
    (max, r) => Math.max(max, r.visitScore),
    0,
  );
  if (bestVisit > stats.bestVisitScore) stats.bestVisitScore = bestVisit;
  if (summary.threeDartAverage > stats.bestGameAverage) {
    stats.bestGameAverage = summary.threeDartAverage;
  }
}
