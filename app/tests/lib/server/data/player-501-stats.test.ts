import { beforeEach, describe, expect, it } from "vitest";
import "@tests/helpers/mock-db";
import { mockDb, TEST_ENTRY_ENV, userScopedKey } from "@tests/helpers/mock-db";
import { TEST_USER_ID } from "@tests/helpers/constants";
import { createEmpty501Stats } from "@lib/shared/games/501";
import {
  getPlayer501Stats,
  savePlayer501Stats,
} from "@lib/server/data/player-501-stats";

describe("player-501-stats data layer", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("returns empty stats when none stored", async () => {
    const stats = await getPlayer501Stats(TEST_USER_ID);

    expect(stats.gamesCompleted).toBe(0);
    expect(stats.gamesWon).toBe(0);
    expect(stats.totalDartsThrown).toBe(0);
    expect(stats.totalCheckouts).toBe(0);
    expect(stats.bestLegAverage).toBe(0);
    expect(stats.bestMatchAverage).toBe(0);
  });

  it("returns stored stats when found", async () => {
    mockDb.tables.player501Stats.set(userScopedKey(TEST_USER_ID), {
      userId: TEST_USER_ID,
      entryEnv: TEST_ENTRY_ENV,
      gamesCompleted: 8,
      gamesWon: 5,
      totalDartsThrown: 211,
      totalCheckouts: 7,
      bestLegAverage: 82.3,
      bestMatchAverage: 75.1,
    });

    const stats = await getPlayer501Stats(TEST_USER_ID);

    expect(stats).toEqual({
      gamesCompleted: 8,
      gamesWon: 5,
      totalDartsThrown: 211,
      totalCheckouts: 7,
      bestLegAverage: 82.3,
      bestMatchAverage: 75.1,
    });
  });

  it("saves stats for user key", async () => {
    const stats = createEmpty501Stats();
    stats.gamesCompleted = 3;
    stats.gamesWon = 2;
    stats.totalDartsThrown = 81;
    stats.totalCheckouts = 4;
    stats.bestLegAverage = 78.4;
    stats.bestMatchAverage = 71.9;

    await savePlayer501Stats(TEST_USER_ID, stats);

    expect(mockDb.tables.player501Stats.get(userScopedKey(TEST_USER_ID))).toEqual({
      userId: TEST_USER_ID,
      entryEnv: TEST_ENTRY_ENV,
      gamesCompleted: 3,
      gamesWon: 2,
      totalDartsThrown: 81,
      totalCheckouts: 4,
      bestLegAverage: 78.4,
      bestMatchAverage: 71.9,
    });
  });
});
