import { describe, it, expect } from "vitest";
import { getSkillProfile } from "@lib/shared/dartbot";
import { chooseIntent } from "@lib/shared/dartbot/strategy-engine";

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

  it("chooses setup on unfinishable odd leaves below 40", () => {
    expect(
      chooseIntent({
        remaining: 3,
        dartsLeft: 3,
        skill: getSkillProfile(10),
        legTarget: 72,
      }),
    ).toBe("setup");
  });
});

