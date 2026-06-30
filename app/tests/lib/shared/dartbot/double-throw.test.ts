import { describe, expect, it } from "vitest";
import {
  createRng,
  getSkillProfile,
  parseSegment,
  scoreForSegment,
  type ConvergenceBias,
  type Rng,
} from "@lib/shared/dartbot";
import { throwDoubleDart } from "../../../../src/lib/shared/dartbot/double-throw";

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

describe("throwDoubleDart", () => {
  it("resolves inside bucket to single same base", () => {
    const target = parseSegment("D20");
    const actual = throwDoubleDart(
      target,
      getSkillProfile(1),
      1,
      zeroBias,
      scriptedRng(0, 0.1),
    );

    expect(actual.label).toBe("20");
  });

  it("outside bucket scores 0", () => {
    const target = parseSegment("D20");
    const actual = throwDoubleDart(
      target,
      getSkillProfile(1),
      1,
      zeroBias,
      scriptedRng(0, 0.8),
    );

    expect(actual.label).toBe("outside");
    expect(scoreForSegment(actual)).toBe(0);
  });

  it("neighbor double resolves to board-neighbor doubles", () => {
    const target = parseSegment("D20");
    const actual = throwDoubleDart(
      target,
      getSkillProfile(1),
      1,
      zeroBias,
      scriptedRng(0, 0.7),
    );

    expect(actual.label === "D1" || actual.label === "D5").toBe(true);
  });

  it("supports random distribution over many attempts", () => {
    const target = parseSegment("D16");
    const profile = getSkillProfile(5);
    let hits = 0;

    for (let i = 0; i < 200; i += 1) {
      const actual = throwDoubleDart(target, profile, 2, zeroBias, createRng(i + 10));
      if (actual.label === "D16") hits += 1;
    }

    expect(hits).toBeGreaterThan(0);
  });
});
