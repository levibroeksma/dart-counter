import { describe, it, expect } from "vitest";
import { createRng, getSkillProfile } from "@lib/shared/dartbot";
import { chooseIntent } from "@lib/shared/dartbot/strategy-engine";
import { chooseScoringTarget } from "@lib/shared/dartbot/route-engine";

describe("strategy-engine", () => {
  it("chooses checkout when remaining <= 170 and finishable", () => {
    expect(
      chooseIntent({
        remaining: 40,
        dartsLeft: 3,
        skill: getSkillProfile(10),
        legTarget: 72,
      }),
    ).toBe("checkout");
  });

  it("chooses setup below level 10 in 131-170 finishable zone", () => {
    expect(
      chooseIntent({
        remaining: 150,
        dartsLeft: 3,
        skill: getSkillProfile(5),
        legTarget: 55,
      }),
    ).toBe("setup");
  });

  it("chooses checkout at level 10+ in 131-170 finishable zone", () => {
    expect(
      chooseIntent({
        remaining: 150,
        dartsLeft: 3,
        skill: getSkillProfile(10),
        legTarget: 72,
      }),
    ).toBe("checkout");
  });

  it("chooses score otherwise", () => {
    expect(
      chooseIntent({
        remaining: 200,
        dartsLeft: 3,
        skill: getSkillProfile(10),
        legTarget: 72,
      }),
    ).toBe("score");
  });
});

describe("route-engine", () => {
  it("defaults to T20 for scoring", () => {
    const rng = createRng(1);
    expect(
      chooseScoringTarget({ skill: getSkillProfile(15), legTarget: 72, rng })
        .label,
    ).toBe("T20");
  });
});
