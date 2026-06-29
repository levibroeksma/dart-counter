import { describe, it, expect } from "vitest";
import { classifyVisit } from "@lib/shared/games/501/visit";

describe("classifyVisit", () => {
  it("scores a normal visit", () => {
    expect(classifyVisit(501, 60)).toEqual({
      bust: false,
      checkout: false,
      remainingAfter: 441,
    });
  });

  it("busts when score goes below zero", () => {
    expect(classifyVisit(10, 12).bust).toBe(true);
  });

  it("busts when leaving 1", () => {
    expect(classifyVisit(42, 41).bust).toBe(true);
  });

  it("checkouts on valid finish (D20 from 40)", () => {
    expect(classifyVisit(40, 40)).toEqual({
      bust: false,
      checkout: true,
      remainingAfter: 0,
    });
  });

  it("busts on invalid checkout (bogey 169)", () => {
    expect(classifyVisit(169, 169).bust).toBe(true);
  });
});
