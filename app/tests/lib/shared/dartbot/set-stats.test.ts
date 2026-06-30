import { describe, expect, it } from "vitest";
import {
  computeSetRunningStats,
  type BotVisitForStats,
} from "@lib/shared/dartbot/set-stats";

describe("computeSetRunningStats", () => {
  it("computes set running stats from bot visits", () => {
    const visits: BotVisitForStats[] = [
      {
        dartsThrown: 3,
        visitScore: 100,
        isScoringVisit: true,
        doubleAttempts: 0,
        checkouts: 0,
      },
      {
        dartsThrown: 3,
        visitScore: 60,
        isScoringVisit: true,
        doubleAttempts: 0,
        checkouts: 0,
      },
      {
        dartsThrown: 2,
        visitScore: 40,
        isScoringVisit: false,
        doubleAttempts: 2,
        checkouts: 1,
      },
    ];

    expect(computeSetRunningStats(visits)).toEqual({
      dartsThrown: 8,
      scoringVisitCount: 2,
      threeDartAverage: 75,
      scoringAverage: 80,
      checkoutPercentage: 50,
      doubleAttempts: 2,
      checkouts: 1,
    });
  });

  it("returns empty stats for empty input", () => {
    expect(computeSetRunningStats([])).toEqual({
      dartsThrown: 0,
      scoringVisitCount: 0,
      threeDartAverage: 0,
      scoringAverage: 0,
      checkoutPercentage: 0,
      doubleAttempts: 0,
      checkouts: 0,
    });
  });
});
