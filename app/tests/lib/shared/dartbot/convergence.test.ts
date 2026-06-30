import { describe, expect, it } from "vitest";
import { computeConvergenceBias, getSkillProfile } from "@lib/shared/dartbot";
import { isWithinStatBand } from "@lib/shared/dartbot/stat-validation";
import type { SetRunningStats } from "@lib/shared/dartbot";

function baselineSetStats(level = 10): SetRunningStats {
  const profile = getSkillProfile(level);
  return {
    dartsThrown: 60,
    scoringVisitCount: 15,
    threeDartAverage: (profile.threeDartAverage.min + profile.threeDartAverage.max) / 2,
    scoringAverage: (profile.scoringAverage.min + profile.scoringAverage.max) / 2,
    checkoutPercentage: (profile.checkoutPercentage.min + profile.checkoutPercentage.max) / 2,
    doubleAttempts: 8,
    checkouts: 3,
  };
}

describe("computeConvergenceBias", () => {
  it("returns zero bias when all set stats are inside set bands", () => {
    const profile = getSkillProfile(10);
    const stats = baselineSetStats(10);
    expect(isWithinStatBand(stats.threeDartAverage, profile.threeDartAverage, "set")).toBe(true);
    expect(isWithinStatBand(stats.scoringAverage, profile.scoringAverage, "set")).toBe(true);
    expect(stats.checkoutPercentage).toBeGreaterThanOrEqual(profile.checkoutPercentage.min);
    expect(stats.checkoutPercentage).toBeLessThanOrEqual(profile.checkoutPercentage.max);
    expect(computeConvergenceBias(stats, profile)).toEqual({
      scoringHitShift: 0,
      setupHitShift: 0,
      checkoutHitShift: 0,
    });
  });

  it("boosts scoring and setup when set scoring stats are below band", () => {
    const profile = getSkillProfile(10);
    const stats = baselineSetStats(10);
    stats.threeDartAverage =
      profile.threeDartAverage.min - profile.threeDartAverage.deviation.set.below - 4;
    const bias = computeConvergenceBias(stats, profile);
    expect(bias.scoringHitShift).toBeGreaterThan(0);
    expect(bias.setupHitShift).toBeGreaterThan(0);
  });

  it("trims scoring and setup when set scoring stats are above band", () => {
    const profile = getSkillProfile(10);
    const stats = baselineSetStats(10);
    stats.scoringAverage =
      profile.scoringAverage.max + profile.scoringAverage.deviation.set.above + 5;
    const bias = computeConvergenceBias(stats, profile);
    expect(bias.scoringHitShift).toBeLessThan(0);
    expect(bias.setupHitShift).toBeLessThan(0);
  });

  it("caps shifts at convergence max values", () => {
    const profile = getSkillProfile(10);
    const stats = baselineSetStats(10);
    stats.threeDartAverage = 0;
    stats.checkoutPercentage = 0;
    const bias = computeConvergenceBias(stats, profile);
    expect(bias.scoringHitShift).toBe(profile.convergence.maxScoringHitShift);
    expect(bias.setupHitShift).toBe(profile.convergence.maxSetupHitShift);
    expect(bias.checkoutHitShift).toBe(profile.convergence.maxCheckoutHitShift);
  });

  it("does not bias checkout when there are no double attempts", () => {
    const profile = getSkillProfile(10);
    const stats = baselineSetStats(10);
    stats.checkoutPercentage = 0;
    stats.doubleAttempts = 0;
    const bias = computeConvergenceBias(stats, profile);
    expect(bias.checkoutHitShift).toBe(0);
  });
});
