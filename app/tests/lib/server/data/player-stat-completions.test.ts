import { beforeEach, describe, expect, it } from "vitest";
import "@tests/helpers/mock-db";
import { mockDb, TEST_ENTRY_ENV, userScopedKey } from "@tests/helpers/mock-db";
import { TEST_USER_ID } from "@tests/helpers/constants";
import { computeProfileMetrics, computeSparklineSeries } from "@lib/shared/stats";
import type { StatCompletionRecord } from "@lib/shared/stats";
import {
  getPlayerStatCompletions,
  getProfileDashboardData,
  insertPlayerStatCompletion,
} from "@lib/server/data/player-stat-completions";

function snapshot(overrides: Partial<Omit<StatCompletionRecord, "id">> = {}) {
  return {
    gameSlug: "501",
    completedAt: "2026-06-01T00:00:00.000Z",
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

describe("player-stat-completions data layer", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("returns empty list when no completion rows exist", async () => {
    await expect(getPlayerStatCompletions(TEST_USER_ID)).resolves.toEqual([]);
  });

  it("inserts completion rows and returns them sorted by completedAt", async () => {
    await insertPlayerStatCompletion(
      TEST_USER_ID,
      snapshot({
        gameSlug: "ten-up-one-down",
        completedAt: "2026-06-10T00:00:00.000Z",
        pointsScored: 90,
        dartsThrown: 6,
      }),
    );
    await insertPlayerStatCompletion(
      TEST_USER_ID,
      snapshot({
        gameSlug: "501",
        completedAt: "2026-06-01T00:00:00.000Z",
        pointsScored: 501,
        dartsThrown: 9,
      }),
    );

    const rows = await getPlayerStatCompletions(TEST_USER_ID);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.completedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(rows[1]?.completedAt).toBe("2026-06-10T00:00:00.000Z");
    expect(rows[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("builds profile dashboard data with aggregate counts", async () => {
    mockDb.tables.player501Stats.set(userScopedKey(TEST_USER_ID), {
      userId: TEST_USER_ID,
      entryEnv: TEST_ENTRY_ENV,
      gamesCompleted: 4,
      gamesWon: 2,
      totalDartsThrown: 200,
      totalCheckouts: 8,
      bestLegAverage: 75,
      bestMatchAverage: 70,
    });
    mockDb.tables.playerScoreTrainingStats.set(userScopedKey(TEST_USER_ID), {
      userId: TEST_USER_ID,
      entryEnv: TEST_ENTRY_ENV,
      gamesCompleted: 3,
      totalDartsThrown: 180,
      totalPointsScored: 5200,
      bestVisitScore: 140,
      bestGameAverage: 71,
    });
    mockDb.tables.playerSinglesTrainingStats.set(userScopedKey(TEST_USER_ID), {
      userId: TEST_USER_ID,
      entryEnv: TEST_ENTRY_ENV,
      gamesCompleted: 5,
      gamesFailed: 1,
      totalDartsThrown: 150,
      totalHits: 90,
      totalScore: 1600,
      dartPositionHits: [30, 31, 29],
      dartPositionAttempts: [50, 50, 50],
      bestHitRatio: 0.7,
      bestScore: 410,
    });

    await insertPlayerStatCompletion(
      TEST_USER_ID,
      snapshot({
        gameSlug: "ten-up-one-down",
        completedAt: "2026-06-01T00:00:00.000Z",
        pointsScored: 60,
        dartsThrown: 3,
        scoringPoints: 60,
        scoringVisits: 1,
        doubleAttempts: 1,
        doubleHits: 1,
      }),
    );
    await insertPlayerStatCompletion(
      TEST_USER_ID,
      snapshot({
        gameSlug: "501",
        completedAt: "2026-06-02T00:00:00.000Z",
        pointsScored: 501,
        dartsThrown: 9,
        scoringPoints: 300,
        scoringVisits: 3,
        doubleAttempts: 2,
        doubleHits: 1,
      }),
    );
    await insertPlayerStatCompletion(
      TEST_USER_ID,
      snapshot({
        gameSlug: "ten-up-one-down",
        completedAt: "2026-06-03T00:00:00.000Z",
        pointsScored: 120,
        dartsThrown: 6,
        scoringPoints: 120,
        scoringVisits: 2,
        doubleAttempts: 1,
        doubleHits: 0,
      }),
    );

    const completions = await getPlayerStatCompletions(TEST_USER_ID);
    const dashboard = await getProfileDashboardData(TEST_USER_ID);

    expect(dashboard.gamesPlayed).toBe(14);
    expect(dashboard.gamesWon).toBe(2);
    expect(dashboard.metrics).toEqual(computeProfileMetrics(completions));
    expect(dashboard.sparklines).toEqual([
      computeSparklineSeries(completions, "threeDartAverage"),
      computeSparklineSeries(completions, "scoringAverage"),
      computeSparklineSeries(completions, "checkoutPercentage"),
    ]);
  });
});
