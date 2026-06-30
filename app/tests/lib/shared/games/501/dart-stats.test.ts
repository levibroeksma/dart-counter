import { describe, expect, it } from "vitest";
import { createEmptyPlayerDartStats } from "@lib/shared/stats";
import {
  apply501VisitToDartStats,
  type FiveOhOneVisitRecord,
} from "@lib/shared/games/501";

describe("501 dart-stats", () => {
  it("partial visit adds doubleAttempts only", () => {
    const stats = createEmptyPlayerDartStats();
    apply501VisitToDartStats(stats, {
      checkout: false,
      dartsOnDouble: 1,
      dartsThrown: 3,
    } as FiveOhOneVisitRecord);
    expect(stats.doubleAttempts).toBe(1);
    expect(stats.doubleHits).toBe(0);
  });

  it("checkout visit adds hits and checkout darts", () => {
    const stats = createEmptyPlayerDartStats();
    apply501VisitToDartStats(stats, {
      checkout: true,
      dartsOnDouble: 1,
      dartsForFinish: 2,
      dartsThrown: 2,
    } as FiveOhOneVisitRecord);
    expect(stats.doubleAttempts).toBe(1);
    expect(stats.doubleHits).toBe(1);
    expect(stats.totalCheckoutDarts).toBe(2);
  });
});
