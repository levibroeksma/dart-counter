import { describe, expect, it } from "vitest";
import {
  boardNeighbors,
  createRng,
  getSkillProfile,
  parseSegment,
  type ConvergenceBias,
  type Rng,
} from "@lib/shared/dartbot";
import { throwSetupDart } from "@lib/shared/dartbot/setup-throw";

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

describe("throwSetupDart", () => {
  it("resolves neighbor single using boardNeighbors", () => {
    const profile = getSkillProfile(1);
    const target = parseSegment("12");
    const expected = boardNeighbors(12);

    const firstNeighbor = throwSetupDart(target, profile, zeroBias, scriptedRng(0.2, 0));
    const secondNeighbor = throwSetupDart(target, profile, zeroBias, scriptedRng(0.2, 0.999));

    expect(firstNeighbor.ring).toBe("single");
    expect(secondNeighbor.ring).toBe("single");
    expect(new Set([firstNeighbor.base, secondNeighbor.base])).toEqual(new Set(expected));
  });

  it("L1 outer-bull setup resolves 'other' more than outside", () => {
    let other = 0;
    let outside = 0;

    for (let i = 0; i < 1000; i += 1) {
      const actual = throwSetupDart(
        parseSegment("25"),
        getSkillProfile(1),
        zeroBias,
        createRng(i + 1),
      );

      if (actual.label === "outside") outside += 1;
      else if (!["25", "50"].includes(actual.label)) other += 1;
    }

    expect(other).toBeGreaterThan(outside);
  });
});
