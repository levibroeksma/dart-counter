import { describe, it, expect, beforeEach } from "vitest";
import "@tests/helpers/mock-db";
import { mockDb, sessionScopedKey, TEST_ENTRY_ENV, userScopedKey } from "@tests/helpers/mock-db";
import { TEST_USER_ID } from "@tests/helpers/constants";
import { createEmptyScoreTrainingStats } from "@lib/shared/games/score-training/stats";

import {
  createScoreTrainingSession,
  getScoreTrainingSession,
  saveScoreTrainingSession,
  deleteScoreTrainingSession,
} from "@lib/server/data/score-training-session";
import {
  getPlayerScoreTrainingStats,
  savePlayerScoreTrainingStats,
} from "@lib/server/data/player-score-training-stats";

describe("score-training session data layer", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("creates session with initial state", async () => {
    const session = await createScoreTrainingSession("alex", {
      endMode: "rounds",
      roundCount: 10,
    });

    expect(session.slug).toBe("score-training");
    expect(session.state.currentScore).toBe(0);
    expect(session.state.currentRound).toBe(1);
    expect(session.timeRemainingSeconds).toBeNull();
    expect(mockDb.tables.gameSessions.get(sessionScopedKey("alex", "score-training"))).toEqual(
      expect.objectContaining({
        userId: "alex",
        gameSlug: "score-training",
        sessionData: expect.objectContaining({ slug: "score-training" }),
      }),
    );
  });

  it("creates timed session with countdown", async () => {
    const session = await createScoreTrainingSession("alex", {
      endMode: "timed",
      playtimeSeconds: 600,
    });

    expect(session.timeRemainingSeconds).toBe(600);
  });

  it("gets existing session", async () => {
    mockDb.tables.gameSessions.set(sessionScopedKey("alex", "score-training"), {
      userId: "alex",
      gameSlug: "score-training",
      entryEnv: TEST_ENTRY_ENV,
      sessionData: {
        slug: "score-training",
        settings: { endMode: "rounds", roundCount: 10 },
        state: {
          currentRound: 2,
          currentScore: 45,
          status: "active",
          lastScore: 15,
        },
        roundHistory: [],
        timeRemainingSeconds: null,
        createdAt: "",
        updatedAt: "",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const session = await getScoreTrainingSession("alex");

    expect(session?.state.currentScore).toBe(45);
  });

  it("returns null for legacy config-only shapes", async () => {
    mockDb.tables.gameSessions.set(sessionScopedKey("alex", "score-training"), {
      userId: "alex",
      gameSlug: "score-training",
      entryEnv: TEST_ENTRY_ENV,
      sessionData: {
        slug: "score-training",
        settings: { targetScore: 10 },
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(getScoreTrainingSession("alex")).resolves.toBeNull();
  });

  it("saves session", async () => {
    await saveScoreTrainingSession("alex", {
      slug: "score-training",
      settings: { endMode: "rounds", roundCount: 10 },
      state: {
        currentRound: 1,
        currentScore: 0,
        status: "active",
        lastScore: null,
      },
      roundHistory: [],
      timeRemainingSeconds: null,
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    });

    expect(mockDb.tables.gameSessions.get(sessionScopedKey("alex", "score-training"))?.sessionData).toEqual(
      expect.objectContaining({ slug: "score-training" }),
    );
  });

  it("deletes session", async () => {
    mockDb.tables.gameSessions.set(sessionScopedKey("alex", "score-training"), {
      userId: "alex",
      gameSlug: "score-training",
      entryEnv: TEST_ENTRY_ENV,
      sessionData: {
        slug: "score-training",
        settings: { endMode: "rounds", roundCount: 10 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await deleteScoreTrainingSession("alex");

    expect(mockDb.tables.gameSessions.get(sessionScopedKey("alex", "score-training"))).toBeUndefined();
  });
});

describe("player-score-training-stats data layer", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("returns empty stats when none stored", async () => {
    await expect(getPlayerScoreTrainingStats(TEST_USER_ID)).resolves.toEqual(
      createEmptyScoreTrainingStats(),
    );
  });

  it("returns stored stats when found", async () => {
    mockDb.tables.playerScoreTrainingStats.set(userScopedKey(TEST_USER_ID), {
      userId: TEST_USER_ID,
      entryEnv: TEST_ENTRY_ENV,
      gamesCompleted: 4,
      totalDartsThrown: 120,
      totalPointsScored: 345,
      bestVisitScore: 120,
      bestGameAverage: 68.75,
    });

    const stats = await getPlayerScoreTrainingStats(TEST_USER_ID);

    expect(stats.gamesCompleted).toBe(4);
    expect(stats.totalPointsScored).toBe(345);
    expect(stats.bestGameAverage).toBe(68.75);
  });

  it("saves stats for user key", async () => {
    const stats = createEmptyScoreTrainingStats();
    stats.gamesCompleted = 2;
    stats.totalDartsThrown = 60;
    stats.totalPointsScored = 180;

    await savePlayerScoreTrainingStats(TEST_USER_ID, stats);

    expect(mockDb.tables.playerScoreTrainingStats.get(userScopedKey(TEST_USER_ID))).toEqual({
      userId: TEST_USER_ID,
      entryEnv: TEST_ENTRY_ENV,
      gamesCompleted: 2,
      totalDartsThrown: 60,
      totalPointsScored: 180,
      bestVisitScore: 0,
      bestGameAverage: 0,
    });
  });
});
