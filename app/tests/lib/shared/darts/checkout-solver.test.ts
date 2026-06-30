import { describe, it, expect } from "vitest";
import { solveCheckoutConstraints } from "@lib/shared/darts";

describe("solveCheckoutConstraints", () => {
  it("returns min/max finish dart counts for finishable scores", () => {
    expect(solveCheckoutConstraints(40)).toEqual({ minFinish: 1, maxFinish: 3 });
    expect(solveCheckoutConstraints(41)).toEqual({ minFinish: 2, maxFinish: 3 });
    expect(solveCheckoutConstraints(170)).toEqual({ minFinish: 3, maxFinish: 3 });
    expect(solveCheckoutConstraints(161)).toEqual({ minFinish: 3, maxFinish: 3 });
  });

  it("returns null for bogeys and unfinishable scores", () => {
    expect(solveCheckoutConstraints(169)).toBeNull();
    expect(solveCheckoutConstraints(1)).toBeNull();
    expect(solveCheckoutConstraints(171)).toBeNull();
  });
});
