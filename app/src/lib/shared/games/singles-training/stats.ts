import type { SinglesTrainingSession } from "./types";
import { isHit } from "./dart";
import { buildSummary } from "./summary";

export type PlayerSinglesTrainingStats = {
  gamesCompleted: number;
  gamesFailed: number;
  totalDartsThrown: number;
  totalHits: number;
  totalScore: number;
  dartPositionHits: [number, number, number];
  dartPositionAttempts: [number, number, number];
  bestHitRatio: number;
  bestScore: number;
};

export function createEmptySinglesTrainingStats(): PlayerSinglesTrainingStats {
  return {
    gamesCompleted: 0,
    gamesFailed: 0,
    totalDartsThrown: 0,
    totalHits: 0,
    totalScore: 0,
    dartPositionHits: [0, 0, 0],
    dartPositionAttempts: [0, 0, 0],
    bestHitRatio: 0,
    bestScore: 0,
  };
}

export function applyGameCompletionToStats(
  stats: PlayerSinglesTrainingStats,
  session: SinglesTrainingSession,
): void {
  const summary = buildSummary(session);
  if (summary.status === "completed") stats.gamesCompleted += 1;
  if (summary.status === "dead") stats.gamesFailed += 1;

  stats.totalDartsThrown += summary.dartsThrown;
  stats.totalScore += summary.score;
  const hits = session.dartHistory.filter((d) => isHit(d.outcome)).length;
  stats.totalHits += hits;

  for (let i = 0; i < 3; i += 1) {
    const attempts = session.dartHistory.filter((d) => d.dartInVisit === i).length;
    const positionHits = session.dartHistory.filter(
      (d) => d.dartInVisit === i && isHit(d.outcome),
    ).length;
    stats.dartPositionAttempts[i] += attempts;
    stats.dartPositionHits[i] += positionHits;
  }

  if (summary.hitRatio > stats.bestHitRatio) stats.bestHitRatio = summary.hitRatio;
  if (summary.score > stats.bestScore) stats.bestScore = summary.score;
}
