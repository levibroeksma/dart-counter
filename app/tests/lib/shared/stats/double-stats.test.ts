import { describe, it, expect } from "vitest";
import { createEmptyPlayerDartStats, applyRoundToStats, revertRoundFromStats } from "@lib/shared/stats/double-stats";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

const successRound: TenUpOneDownRoundRecord = {
  roundNumber: 1,
  targetAtStart: 41,
  targetAfter: 51,
  finished: true,
  dartsUsed: 2,
  doubleAttempts: [
    { double: "D16", hit: false },
    { double: "D16", hit: true },
  ],
};

const failureRound: TenUpOneDownRoundRecord = {
  roundNumber: 2,
  targetAtStart: 51,
  targetAfter: 50,
  finished: false,
  dartsUsed: 3,
  doubleAttempts: [{ double: "D20", hit: false }],
  busted: true,
};

describe("double-stats", () => {
  it("applies success round stats", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, successRound);
    expect(stats.doubleStats.D16).toEqual({ attempts: 2, successes: 1 });
    expect(stats.totalCheckouts).toBe(1);
    expect(stats.totalCheckoutDarts).toBe(2);
  });

  it("reverts a previously applied round", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, successRound);
    revertRoundFromStats(stats, successRound);
    expect(stats.doubleStats.D16).toEqual({ attempts: 0, successes: 0 });
    expect(stats.totalCheckouts).toBe(0);
    expect(stats.totalCheckoutDarts).toBe(0);
  });

  it("applies failure round without checkout totals", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, failureRound);
    expect(stats.doubleStats.D20).toEqual({ attempts: 1, successes: 0 });
    expect(stats.totalCheckouts).toBe(0);
  });
});
