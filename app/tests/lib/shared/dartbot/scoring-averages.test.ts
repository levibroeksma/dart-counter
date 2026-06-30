import { describe, expect, it } from "vitest";
import {
  createRng,
  generateMatchPlan,
  getSkillProfile,
  simulateVisit,
} from "@lib/shared/dartbot";

function simulateScoringAverage(level: number, seed: number): number {
  const skill = getSkillProfile(level);
  const plan = generateMatchPlan(skill, 5, seed);
  const rng = createRng(seed);
  let remaining = 501;
  let totalPoints = 0;
  let visitCount = 0;

  while (remaining > 170 && visitCount < 120) {
    const legTarget = plan.legTargets[0]!;
    const visit = simulateVisit(
      { remaining, skill, legTarget, dartsInVisit: 3 },
      rng,
    );
    if (!visit.bust) {
      totalPoints += visit.visitScore;
      remaining -= visit.visitScore;
      visitCount++;
    }
  }

  return totalPoints / visitCount;
}

describe("simulateVisit scoring averages by level", () => {
  it("level 2 aims at treble beds when scoring", () => {
    const result = simulateVisit(
      {
        remaining: 501,
        skill: getSkillProfile(2),
        legTarget: 40,
        dartsInVisit: 3,
      },
      createRng(42),
    );

    expect(result.darts[0]?.target.ring).toBe("triple");
    expect(["T20", "T19", "T18"]).toContain(result.darts[0]?.target.label);
  });

  it("level 2 scores below pro territory with T20-first aiming", () => {
    const actual = simulateScoringAverage(2, 42);
    expect(actual).toBeLessThan(130);
    expect(actual).toBeGreaterThan(15);
  });

  it("level 15 scores higher than level 2", () => {
    const low = simulateScoringAverage(2, 99);
    const high = simulateScoringAverage(15, 99);
    expect(high).toBeGreaterThan(low + 10);
  });
});
