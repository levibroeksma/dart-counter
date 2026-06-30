import { describe, expect, it } from "vitest";
import type {
  DeviationBand,
  DoubleOutcomes,
  LevelProfile,
  StatRange,
} from "@lib/shared/dartbot/types";

describe("dartbot distribution types", () => {
  it("StatRange includes leg and set deviation bands", () => {
    const range: StatRange = {
      min: 30,
      max: 40,
      deviation: {
        leg: { below: 5, above: 5 },
        set: { below: 3, above: 3 },
      },
    };
    expect(range.deviation.leg.below).toBe(5);
  });

  it("DoubleOutcomes weights sum conceptually to 100", () => {
    const outcomes: DoubleOutcomes = {
      hit: 14,
      inside: 20,
      neighborSingle: 30,
      neighborDouble: 12,
      outside: 19,
      other: 5,
    };
    const sum = Object.values(outcomes).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });
});
