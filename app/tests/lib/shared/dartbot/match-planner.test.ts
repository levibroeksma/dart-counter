import { describe, it, expect } from "vitest";
import { generateMatchPlan, getSkillProfile } from "@lib/shared/dartbot";

describe("generateMatchPlan", () => {
  it("distributes leg targets around skill midpoint", () => {
    const skill = getSkillProfile(10);
    const plan = generateMatchPlan(skill, 5, 42);
    expect(plan.legTargets).toHaveLength(5);
    const avg = plan.legTargets.reduce((a, b) => a + b, 0) / 5;
    const midpoint =
      (skill.threeDartAverage.min + skill.threeDartAverage.max) / 2;
    expect(avg).toBeGreaterThan(midpoint - 15);
    expect(avg).toBeLessThan(midpoint + 15);
  });

  it("is deterministic for same seed", () => {
    const skill = getSkillProfile(5);
    const a = generateMatchPlan(skill, 3, 999);
    const b = generateMatchPlan(skill, 3, 999);
    expect(a.legTargets).toEqual(b.legTargets);
  });

  it("extends leg targets when match exceeds estimate", () => {
    const skill = getSkillProfile(10);
    const plan = generateMatchPlan(skill, 3, 1);
    const extended = plan.extendLegTargets(5);
    expect(extended).toHaveLength(5);
    expect(extended.slice(0, 3)).toEqual(plan.legTargets);
  });

  it("uses asymmetric leg deviation bands for sampling", () => {
    const skill = getSkillProfile(10);
    const plan = generateMatchPlan(skill, 50, 7);
    const midpoint =
      (skill.threeDartAverage.min + skill.threeDartAverage.max) / 2;
    const offsets = plan.legTargets.map((value) => value - midpoint);
    const minOffset = Math.min(...offsets);
    const maxOffset = Math.max(...offsets);

    expect(Math.abs(maxOffset)).toBeGreaterThan(Math.abs(minOffset));
  });
});
