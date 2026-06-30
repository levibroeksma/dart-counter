import { describe, it, expect } from "vitest";
import { getSkillProfile, ANCHOR_LEVELS } from "@lib/shared/dartbot/levels";

describe("levels", () => {
  it("returns anchor profiles unchanged", () => {
    expect(getSkillProfile(1).execution.hitAccuracy).toBe(
      ANCHOR_LEVELS[0]!.execution.hitAccuracy,
    );
    expect(getSkillProfile(15).execution.hitAccuracy).toBe(
      ANCHOR_LEVELS[3]!.execution.hitAccuracy,
    );
  });

  it("interpolates level 3 between 1 and 5", () => {
    const p1 = getSkillProfile(1);
    const p5 = getSkillProfile(5);
    const p3 = getSkillProfile(3);
    expect(p3.execution.hitAccuracy).toBeGreaterThan(p1.execution.hitAccuracy);
    expect(p3.execution.hitAccuracy).toBeLessThan(p5.execution.hitAccuracy);
    expect(p3.level).toBe(3);
  });

  it("rejects out-of-range levels", () => {
    expect(() => getSkillProfile(0)).toThrow();
    expect(() => getSkillProfile(16)).toThrow();
  });
});
