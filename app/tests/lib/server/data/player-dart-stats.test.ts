import { describe, it, expect, beforeEach } from "vitest";
import "@tests/helpers/mock-db";
import { mockDb, TEST_ENTRY_ENV, userScopedKey } from "@tests/helpers/mock-db";
import { TEST_USER_ID } from "@tests/helpers/constants";
import { createEmptyPlayerDartStats } from "@lib/shared/stats";

import {
  getPlayerDartStats,
  savePlayerDartStats,
} from "@lib/server/data/player-dart-stats";

describe("player-dart-stats data layer", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("returns empty stats when none stored", async () => {
    const stats = await getPlayerDartStats(TEST_USER_ID);

    expect(stats.totalCheckouts).toBe(0);
    expect(stats.doubleAttempts).toBe(0);
    expect(stats.doubleHits).toBe(0);
  });

  it("returns stored stats when found", async () => {
    mockDb.tables.playerDartStats.set(userScopedKey(TEST_USER_ID), {
      userId: TEST_USER_ID,
      entryEnv: TEST_ENTRY_ENV,
      doubleAttempts: 12,
      doubleHits: 6,
      totalCheckouts: 4,
      totalCheckoutDarts: 9,
    });

    const stats = await getPlayerDartStats(TEST_USER_ID);

    expect(stats.totalCheckouts).toBe(4);
    expect(stats.totalCheckoutDarts).toBe(9);
  });

  it("saves stats for user key", async () => {
    const stats = createEmptyPlayerDartStats();
    stats.totalCheckouts = 5;
    stats.doubleAttempts = 10;

    await savePlayerDartStats(TEST_USER_ID, stats);

    expect(mockDb.tables.playerDartStats.get(userScopedKey(TEST_USER_ID))).toEqual({
      userId: TEST_USER_ID,
      entryEnv: TEST_ENTRY_ENV,
      doubleAttempts: 10,
      doubleHits: 0,
      totalCheckouts: 5,
      totalCheckoutDarts: 0,
    });
  });
});
