import { describe, it, expect } from "vitest";
import { LEGS_PER_SET } from "@lib/shared/games/501/constants";
import { estimateLegCount } from "@lib/shared/games/501/leg-estimate";

describe("estimateLegCount", () => {
  it("uses target count for legs format", () => {
    expect(
      estimateLegCount({
        matchMode: "best-of",
        targetCount: 5,
        unit: "legs",
        players: [],
      }),
    ).toBe(5);
  });

  it("multiplies sets by legs per set", () => {
    expect(
      estimateLegCount({
        matchMode: "first-to",
        targetCount: 3,
        unit: "sets",
        players: [],
      }),
    ).toBe(3 * LEGS_PER_SET);
  });
});
