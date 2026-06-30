import { describe, expect, it } from "vitest";
import { createRng, getSkillProfile } from "@lib/shared/dartbot";
import { checkoutHitRateForDart } from "@lib/shared/dartbot/checkout-hit-rate";

describe("checkoutHitRateForDart", () => {
  it("returns rates within the checkout range", () => {
    const profile = getSkillProfile(1);
    const rng = createRng(7);
    const min = profile.checkoutPercentage.min / 100;
    const max = profile.checkoutPercentage.max / 100;

    for (let i = 0; i < 50; i += 1) {
      const rate = checkoutHitRateForDart(profile, 1, rng);
      expect(rate).toBeGreaterThanOrEqual(min);
      expect(rate).toBeLessThanOrEqual(max);
    }
  });

  it("returns distinct rates across darts in one visit", () => {
    const profile = getSkillProfile(1);
    const rng = createRng(99);
    const rates = [1, 2, 3].map((dart) =>
      checkoutHitRateForDart(profile, dart as 1 | 2 | 3, rng),
    );

    expect(new Set(rates).size).toBeGreaterThan(1);
  });
});
