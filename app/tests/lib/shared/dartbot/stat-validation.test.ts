import { describe, expect, it } from "vitest";
import { isWithinStatBand } from "@lib/shared/dartbot/stat-validation";
import { getSkillProfile } from "@lib/shared/dartbot";

describe("isWithinStatBand", () => {
  const profile = getSkillProfile(1);

  it("passes at range midpoint for leg scope", () => {
    const mid = (profile.scoringAverage.min + profile.scoringAverage.max) / 2;
    expect(isWithinStatBand(mid, profile.scoringAverage, "leg")).toBe(true);
  });

  it("fails below leg band", () => {
    expect(
      isWithinStatBand(
        profile.scoringAverage.min - profile.scoringAverage.deviation.leg.below - 1,
        profile.scoringAverage,
        "leg",
      ),
    ).toBe(false);
  });

  it("set band is tighter than leg band", () => {
    const actual = profile.threeDartAverage.min - profile.threeDartAverage.deviation.set.below - 0.5;
    expect(isWithinStatBand(actual, profile.threeDartAverage, "set")).toBe(false);
    expect(isWithinStatBand(actual, profile.threeDartAverage, "leg")).toBe(true);
  });
});
