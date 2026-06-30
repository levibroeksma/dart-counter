import { describe, it, expect } from "vitest";
import { getSkillProfile, validateMatchStats } from "@lib/shared/dartbot";

describe("validateMatchStats", () => {
  it("passes when actual stats within tolerance", () => {
    const profile = getSkillProfile(10);
    const result = validateMatchStats(
      {
        threeDartAverage: profile.threeDartAverage.min,
        scoringAverage: 80,
        checkoutPercentage: 35,
      },
      profile,
    );
    expect(result.withinTolerance).toBe(true);
  });

  it("flags out-of-tolerance stats without correcting", () => {
    const profile = getSkillProfile(10);
    const result = validateMatchStats(
      {
        threeDartAverage: 20,
        scoringAverage: 20,
        checkoutPercentage: 5,
      },
      profile,
    );
    expect(result.withinTolerance).toBe(false);
    expect(result.deviations.length).toBeGreaterThan(0);
  });
});
