import { describe, it, expect } from "vitest";
import {
  unitsToWinMatch,
  hasPlayerWonMatch,
} from "@lib/shared/games/501/match";

describe("unitsToWinMatch", () => {
  it("best-of 3 legs requires 2 leg wins", () => {
    expect(
      unitsToWinMatch({ matchMode: "best-of", targetCount: 3, unit: "legs" }),
    ).toBe(2);
  });

  it("first-to 3 sets requires 3 set wins", () => {
    expect(
      unitsToWinMatch({ matchMode: "first-to", targetCount: 3, unit: "sets" }),
    ).toBe(3);
  });
});

describe("hasPlayerWonMatch", () => {
  it("detects leg match win", () => {
    const settings = {
      matchMode: "first-to" as const,
      targetCount: 1,
      unit: "legs" as const,
      players: [{ id: "u1", type: "user" as const, name: "Levi" }],
    };
    const player = {
      playerId: "u1",
      remaining: 0,
      dartsThisLeg: 9,
      lastVisitScore: 60,
      legsWonInSet: 1,
      setsWon: 0,
      totalLegsWon: 1,
    };
    expect(hasPlayerWonMatch(settings, player)).toBe(true);
  });
});
