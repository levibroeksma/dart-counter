import { describe, it, expect } from "vitest";
import { generateMatchPlan } from "@lib/shared/dartbot/match-planner";
import { getSkillProfile } from "@lib/shared/dartbot/levels";

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
});
