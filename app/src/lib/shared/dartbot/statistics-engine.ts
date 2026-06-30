import type { LevelProfile } from "./types";
import { isWithinStatBand } from "./stat-validation";

export type MatchStats = {
  threeDartAverage: number;
  scoringAverage: number;
  checkoutPercentage: number;
};

export type StatsValidation = {
  withinTolerance: boolean;
  deviations: string[];
};

export function validateMatchStats(
  actual: MatchStats,
  profile: LevelProfile,
): StatsValidation {
  const deviations: string[] = [];

  if (!isWithinStatBand(actual.threeDartAverage, profile.threeDartAverage, "leg")) {
    deviations.push("threeDartAverage");
  }
  if (!isWithinStatBand(actual.scoringAverage, profile.scoringAverage, "leg")) {
    deviations.push("scoringAverage");
  }
  if (
    actual.checkoutPercentage < profile.checkoutPercentage.min ||
    actual.checkoutPercentage > profile.checkoutPercentage.max
  ) {
    deviations.push("checkoutPercentage");
  }

  return { withinTolerance: deviations.length === 0, deviations };
}
