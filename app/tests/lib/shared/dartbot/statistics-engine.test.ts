import { describe, it, expect } from "vitest";
import { getSkillProfile, validateMatchStats } from "@lib/shared/dartbot";

describe("validateMatchStats", () => {
  it("passes when actual stats within tolerance", () => {
    const profile = getSkillProfile(10);
    const midpoint =
      (profile.threeDartAverage.min + profile.threeDartAverage.max) / 2;
    const result = validateMatchStats(
      {
        threeDartAverage: midpoint,
        scoringAverage: 80,
        checkoutAverage: 30,
        checkoutRate: 0.55,
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
        checkoutAverage: 5,
        checkoutRate: 0.1,
      },
      profile,
    );
    expect(result.withinTolerance).toBe(false);
    expect(result.deviations.length).toBeGreaterThan(0);
  });
});
