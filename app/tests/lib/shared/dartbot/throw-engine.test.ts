import { describe, it, expect } from "vitest";
import { createRng, getSkillProfile, parseSegment } from "@lib/shared/dartbot";
import { throwDart } from "@lib/shared/dartbot/throw-engine";

describe("throwDart", () => {
  const zeroBias = {
    scoringHitShift: 0,
    setupHitShift: 0,
    checkoutHitShift: 0,
  } as const;

  it("dispatches score intent to scoring engine", () => {
    const skill = getSkillProfile(10);
    const result = throwDart(
      parseSegment("D20"),
      skill,
      "score",
      1,
      zeroBias,
      { next: () => 0, getState: () => 0, setState: () => undefined },
    );
    expect(result.label).toBe("20");
  });

  it("dispatches setup intent to setup engine", () => {
    const skill = getSkillProfile(10);
    const result = throwDart(
      parseSegment("20"),
      skill,
      "setup",
      2,
      zeroBias,
      { next: () => 0, getState: () => 0, setState: () => undefined },
    );
    expect(result.label).toBe("20");
  });

  it("dispatches checkout intent on doubles to double engine", () => {
    const skill = getSkillProfile(10);
    const result = throwDart(
      parseSegment("D20"),
      skill,
      "checkout",
      3,
      zeroBias,
      createRng(1),
    );
    expect(result.label).toBe("D20");
  });
});
