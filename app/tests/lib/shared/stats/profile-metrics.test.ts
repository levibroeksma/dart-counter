// tests/lib/shared/stats/profile-metrics.test.ts
import { describe, expect, it } from "vitest";
import {
  computeProfileMetrics,
  computeSparklineSeries,
  computeMonthDelta,
} from "@lib/shared/stats";
import type { StatCompletionRecord } from "@lib/shared/stats";

function row(
  overrides: Partial<StatCompletionRecord> &
    Pick<StatCompletionRecord, "completedAt">,
): StatCompletionRecord {
  return {
    id: "1",
    gameSlug: "501",
    pointsScored: 0,
    dartsThrown: 0,
    scoringPoints: 0,
    scoringVisits: 0,
    doubleAttempts: 0,
    doubleHits: 0,
    visits100Plus: 0,
    visits120Plus: 0,
    visits140Plus: 0,
    visits180: 0,
    segmentHits: 0,
    segmentAttempts: 0,
    ...overrides,
  };
}

describe("computeProfileMetrics", () => {
  it("computes weighted 3-dart average from 501 rows only", () => {
    const metrics = computeProfileMetrics([
      row({
        completedAt: "2026-07-01T00:00:00.000Z",
        pointsScored: 501,
        dartsThrown: 9,
      }),
      row({
        completedAt: "2026-07-02T00:00:00.000Z",
        pointsScored: 300,
        dartsThrown: 9,
      }),
    ]);
    expect(metrics.threeDartAverage).toBeCloseTo(133.5, 1);
  });

  it("returns null when no contributing data", () => {
    expect(computeProfileMetrics([])).toEqual({
      threeDartAverage: null,
      scoringAverage: null,
      checkoutPercentage: null,
    });
  });
});

describe("computeSparklineSeries", () => {
  it("emits cumulative prefix averages for last-30d window", () => {
    const now = new Date("2026-07-26T12:00:00.000Z");
    const completions = [
      row({
        id: "a",
        completedAt: "2026-06-20T00:00:00.000Z",
        pointsScored: 450,
        dartsThrown: 30,
      }),
      row({
        id: "b",
        completedAt: "2026-07-01T00:00:00.000Z",
        pointsScored: 501,
        dartsThrown: 9,
      }),
      row({
        id: "c",
        completedAt: "2026-07-12T00:00:00.000Z",
        pointsScored: 200,
        dartsThrown: 9,
      }),
    ];
    const series = computeSparklineSeries(completions, "threeDartAverage", {
      now,
      windowDays: 30,
    });
    expect(series.points.length).toBe(2);
    expect(series.points[0].y).toBeCloseTo(73, 0);
    expect(series.points[1].y).toBeLessThan(series.points[0].y);
  });
});

describe("computeMonthDelta", () => {
  it("returns absolute delta for averages", () => {
    const now = new Date("2026-07-26T00:00:00.000Z");
    const completions = [
      row({
        completedAt: "2026-06-01T00:00:00.000Z",
        pointsScored: 450,
        dartsThrown: 30,
      }),
      row({
        completedAt: "2026-07-20T00:00:00.000Z",
        pointsScored: 501,
        dartsThrown: 9,
      }),
    ];
    const delta = computeMonthDelta(completions, "threeDartAverage", now);
    expect(delta).not.toBeNull();
    expect(delta!.absolute).toBeGreaterThan(0);
  });
});
