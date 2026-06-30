import { describe, expect, it } from "vitest";
import { buildLevelProfile } from "../../../../src/lib/shared/dartbot/interpolate-levels";

function sumWeights(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + b, 0);
}

describe("buildLevelProfile", () => {
  it("returns exact anchors unchanged", () => {
    const l5 = buildLevelProfile(5);
    expect(l5.scoring.outcomes.T20).toBe(8);
    expect(sumWeights(l5.scoring.outcomes)).toBe(100);
  });

  it("L2 scoring matches draft table", () => {
    const l2 = buildLevelProfile(2);
    expect(l2.scoring.outcomes).toMatchObject({ S20: 39, T20: 4, outside: 5 });
    expect(l2.scoring.aim).toBe("S20");
  });

  it("L6 aims T20", () => {
    expect(buildLevelProfile(6).scoring.aim).toBe("T20");
  });

  it("rejects level 11", () => {
    expect(() => buildLevelProfile(11)).toThrow(/Invalid DartBot level/);
  });
});
