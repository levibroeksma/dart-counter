import { describe, it, expect } from "vitest";
import { getSkillProfile } from "@lib/shared/dartbot";

describe("levels", () => {
  it("returns anchor profiles unchanged", () => {
    expect(getSkillProfile(1).scoring.outcomes.S20).toBe(35);
    expect(getSkillProfile(10).scoring.outcomes.T20).toBe(31);
  });

  it("interpolates level 3 between 1 and 5", () => {
    const p1 = getSkillProfile(1);
    const p5 = getSkillProfile(5);
    const p3 = getSkillProfile(3);
    expect(p3.scoring.outcomes.S20).toBeGreaterThan(p1.scoring.outcomes.S20);
    expect(p3.scoring.outcomes.S20).toBeLessThan(p5.scoring.outcomes.S20);
    expect(p3.level).toBe(3);
  });

  it("getSkillProfile(10) returns level 10 profile", () => {
    const p10 = getSkillProfile(10);
    expect(p10.level).toBe(10);
    expect(p10.scoring.outcomes.T20).toBe(31);
  });

  it("rejects out-of-range levels", () => {
    expect(() => getSkillProfile(0)).toThrow();
    expect(() => getSkillProfile(11)).toThrow();
  });
});
