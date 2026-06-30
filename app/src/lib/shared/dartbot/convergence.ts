import { isWithinStatBand } from "./stat-validation";
import type { ConvergenceBias, SetRunningStats, SkillProfile } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dominantShift(values: number[]): number {
  let selected = 0;
  for (const value of values) {
    if (Math.abs(value) > Math.abs(selected)) {
      selected = value;
    }
  }
  return selected;
}

function statBandShift(
  actual: number,
  min: number,
  max: number,
  below: number,
  above: number,
  distanceScale: number,
): number {
  const low = min - below;
  const high = max + above;
  if (actual < low) return (low - actual) * distanceScale;
  if (actual > high) return -((actual - high) * distanceScale);
  return 0;
}

function checkoutBandShift(
  actual: number,
  min: number,
  max: number,
  distanceScale: number,
): number {
  if (actual < min) return (min - actual) * distanceScale;
  if (actual > max) return -((actual - max) * distanceScale);
  return 0;
}

/**
 * Computes a minimal set-level hit-rate correction for scoring/setup/checkout.
 */
export function computeConvergenceBias(
  stats: SetRunningStats,
  profile: SkillProfile,
): ConvergenceBias {
  const threeDaInside = isWithinStatBand(
    stats.threeDartAverage,
    profile.threeDartAverage,
    "set",
  );
  const scoringInside = isWithinStatBand(
    stats.scoringAverage,
    profile.scoringAverage,
    "set",
  );
  const checkoutInside =
    stats.doubleAttempts === 0 ||
    (stats.checkoutPercentage >= profile.checkoutPercentage.min &&
      stats.checkoutPercentage <= profile.checkoutPercentage.max);

  if (threeDaInside && scoringInside && checkoutInside) {
    return { scoringHitShift: 0, setupHitShift: 0, checkoutHitShift: 0 };
  }

  const scoringRaw = dominantShift([
    statBandShift(
      stats.threeDartAverage,
      profile.threeDartAverage.min,
      profile.threeDartAverage.max,
      profile.threeDartAverage.deviation.set.below,
      profile.threeDartAverage.deviation.set.above,
      profile.convergence.distanceScale,
    ),
    statBandShift(
      stats.scoringAverage,
      profile.scoringAverage.min,
      profile.scoringAverage.max,
      profile.scoringAverage.deviation.set.below,
      profile.scoringAverage.deviation.set.above,
      profile.convergence.distanceScale,
    ),
  ]);

  const checkoutRaw =
    stats.doubleAttempts > 0
      ? checkoutBandShift(
          stats.checkoutPercentage,
          profile.checkoutPercentage.min,
          profile.checkoutPercentage.max,
          profile.convergence.distanceScale,
        )
      : 0;

  return {
    scoringHitShift: clamp(
      scoringRaw,
      -profile.convergence.maxScoringHitShift,
      profile.convergence.maxScoringHitShift,
    ),
    setupHitShift: clamp(
      scoringRaw,
      -profile.convergence.maxSetupHitShift,
      profile.convergence.maxSetupHitShift,
    ),
    checkoutHitShift: clamp(
      checkoutRaw,
      -profile.convergence.maxCheckoutHitShift,
      profile.convergence.maxCheckoutHitShift,
    ),
  };
}
