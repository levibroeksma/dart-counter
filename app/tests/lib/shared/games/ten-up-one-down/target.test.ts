import { describe, it, expect } from "vitest";
import { resolveTargetAfterRound } from "@lib/shared/games/ten-up-one-down/target";

describe("resolveTargetAfterRound", () => {
  it("adds 10 on success", () => {
    expect(resolveTargetAfterRound(41, true)).toEqual({ target: 51, completedOn170: false });
  });

  it("subtracts 1 on failure", () => {
    expect(resolveTargetAfterRound(41, false)).toEqual({ target: 40, completedOn170: false });
  });

  it("snaps bogey on success preferring higher", () => {
    expect(resolveTargetAfterRound(149, true).target).toBe(160);
  });

  it("clamps to min target 2", () => {
    expect(resolveTargetAfterRound(2, false).target).toBe(2);
  });

  it("flags completion on successful checkout at 170", () => {
    expect(resolveTargetAfterRound(170, true)).toEqual({ target: 170, completedOn170: true });
  });
});
