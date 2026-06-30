import type { LevelProfile } from "@lib/shared/dartbot/types";

export type MatchStats = {
  threeDartAverage: number;
  scoringAverage: number;
  checkoutAverage: number;
  checkoutRate: number;
};

export type StatsValidation = {
  withinTolerance: boolean;
  deviations: string[];
};

function withinPercent(
  actual: number,
  expected: number,
  tolerance: number,
): boolean {
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) / expected <= tolerance;
}

export function validateMatchStats(
  actual: MatchStats,
  profile: LevelProfile,
): StatsValidation {
  const expected3da =
    (profile.threeDartAverage.min + profile.threeDartAverage.max) / 2;
  const expectedSa =
    (profile.scoringAverage.min + profile.scoringAverage.max) / 2;
  const deviations: string[] = [];

  if (!withinPercent(actual.threeDartAverage, expected3da, 0.05)) {
    deviations.push("threeDartAverage");
  }
  if (!withinPercent(actual.scoringAverage, expectedSa, 0.05)) {
    deviations.push("scoringAverage");
  }
  if (!withinPercent(actual.checkoutAverage, profile.checkout.average, 0.1)) {
    deviations.push("checkoutAverage");
  }
  if (!withinPercent(actual.checkoutRate, profile.checkout.successRate, 0.1)) {
    deviations.push("checkoutRate");
  }

  return { withinTolerance: deviations.length === 0, deviations };
}
