import { describe, it, expect } from "vitest";
import {
  applyRoundToStats,
  createEmptyPlayerDartStats,
  revertRoundFromStats,
} from "@lib/shared/stats";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down";

const successRound: TenUpOneDownRoundRecord = {
  roundNumber: 1,
  targetAtStart: 41,
  targetAfter: 51,
  finished: true,
  dartsUsed: 2,
  dartsOnDouble: 2,
};

const failureRound: TenUpOneDownRoundRecord = {
  roundNumber: 2,
  targetAtStart: 51,
  targetAfter: 50,
  finished: false,
  dartsUsed: 3,
  dartsOnDouble: 2,
};

describe("double-stats", () => {
  it("applies success: +dartsOnDouble attempts, +1 hit, checkout totals", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, successRound);
    expect(stats.doubleAttempts).toBe(2);
    expect(stats.doubleHits).toBe(1);
    expect(stats.totalCheckouts).toBe(1);
    expect(stats.totalCheckoutDarts).toBe(2);
  });

  it("applies failure: +dartsOnDouble attempts, no hits or checkout totals", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, failureRound);
    expect(stats.doubleAttempts).toBe(2);
    expect(stats.doubleHits).toBe(0);
    expect(stats.totalCheckouts).toBe(0);
    expect(stats.totalCheckoutDarts).toBe(0);
  });

  it("reverts a previously applied round", () => {
    const stats = createEmptyPlayerDartStats();
    applyRoundToStats(stats, successRound);
    revertRoundFromStats(stats, successRound);
    expect(stats).toEqual(createEmptyPlayerDartStats());
  });
});
