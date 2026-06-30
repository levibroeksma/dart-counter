import type { SetRunningStats } from "./types";

export type BotVisitForStats = {
  dartsThrown: number;
  visitScore: number;
  isScoringVisit: boolean;
  doubleAttempts: number;
  checkouts: number;
};

/**
 * Aggregates dartbot set-level running stats from visit-level inputs.
 */
export function computeSetRunningStats(
  visits: BotVisitForStats[],
): SetRunningStats {
  const dartsThrown = visits.reduce((sum, visit) => sum + visit.dartsThrown, 0);
  const scoringVisits = visits.filter((visit) => visit.isScoringVisit);
  const scoringPoints = scoringVisits.reduce(
    (sum, visit) => sum + visit.visitScore,
    0,
  );
  const doubleAttempts = visits.reduce(
    (sum, visit) => sum + visit.doubleAttempts,
    0,
  );
  const checkouts = visits.reduce((sum, visit) => sum + visit.checkouts, 0);
  const totalPoints = visits.reduce((sum, visit) => sum + visit.visitScore, 0);

  return {
    dartsThrown,
    scoringVisitCount: scoringVisits.length,
    threeDartAverage: dartsThrown > 0 ? (totalPoints / dartsThrown) * 3 : 0,
    scoringAverage:
      scoringVisits.length > 0 ? scoringPoints / scoringVisits.length : 0,
    checkoutPercentage: doubleAttempts > 0 ? (checkouts / doubleAttempts) * 100 : 0,
    doubleAttempts,
    checkouts,
  };
}
