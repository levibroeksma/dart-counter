import { describe, expect, it } from "vitest";
import {
  createRng,
  getSkillProfile,
  scoreForSegment,
  type ConvergenceBias,
  type Rng,
} from "@lib/shared/dartbot";
import { throwScoringDart } from "../../../../src/lib/shared/dartbot/scoring-throw";

const zeroBias: ConvergenceBias = {
  scoringHitShift: 0,
  setupHitShift: 0,
  checkoutHitShift: 0,
};

function scriptedRng(...values: number[]): Rng {
  let index = 0;
  return {
    next: () => {
      const value = values[Math.min(index, values.length - 1)] ?? 0;
      index += 1;
      return value;
    },
    getState: () => index,
    setState: (state: number) => {
      index = state;
    },
  };
}

describe("throwScoringDart", () => {
  it("L1 lands on scoring bed segments", () => {
    const profile = getSkillProfile(1);
    const rng = createRng(42);
    const results = new Set<string>();

    for (let i = 0; i < 200; i += 1) {
      const actual = throwScoringDart(profile, zeroBias, rng);
      if (actual.label !== "outside" && actual.label !== "25" && actual.label !== "50") {
        results.add(actual.label);
      }
    }

    expect(results.has("20")).toBe(true);
    expect(results.has("5")).toBe(true);
    expect(results.has("1")).toBe(true);
  });

  it("outside bucket scores 0", () => {
    const profile = getSkillProfile(1);
    const seg = throwScoringDart(profile, zeroBias, scriptedRng(0.91));
    expect(seg.label).toBe("outside");
    expect(scoreForSegment(seg)).toBe(0);
  });
});
