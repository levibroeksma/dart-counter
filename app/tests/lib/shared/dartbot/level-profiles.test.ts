import { describe, expect, it } from "vitest";
import {
  ANCHOR_PROFILES,
  LEVEL_STAT_RANGES,
} from "../../../../src/lib/shared/dartbot/level-profiles";

function sumWeights(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + b, 0);
}

describe("level-profiles", () => {
  it("has anchors at L1, L5, L10 only", () => {
    expect(ANCHOR_PROFILES.map((p) => p.level)).toEqual([1, 5, 10]);
  });

  it("L1 scoring outcomes sum to 100 and aim S20", () => {
    const l1 = ANCHOR_PROFILES.find((p) => p.level === 1)!;
    expect(l1.scoring.aim).toBe("S20");
    expect(sumWeights(l1.scoring.outcomes)).toBe(100);
    expect(l1.scoring.outcomes.S20).toBe(35);
  });

  it("LEVEL_STAT_RANGES covers levels 1-10 with explicit checkout bands", () => {
    expect(LEVEL_STAT_RANGES).toHaveLength(10);
    expect(LEVEL_STAT_RANGES[0]!.checkoutPercentage).toEqual({ min: 8, max: 30 });
    expect(LEVEL_STAT_RANGES[9]!.checkoutPercentage).toEqual({ min: 30, max: 50 });
  });
});
