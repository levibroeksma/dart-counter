import { describe, it, expect, vi, beforeEach } from "vitest";
import "@tests/helpers/mock-db";
import { mockDb } from "@tests/helpers/mock-db";
import { TEST_USER_ID } from "@tests/helpers/constants";
import { createEmptyScoreTrainingStats } from "@lib/shared/games/score-training/stats";

const mockGet = vi.fn();
const mockSetJSON = vi.fn();
const mockDelete = vi.fn();

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => ({
    get: (...args: unknown[]) => mockGet(...args),
    setJSON: (...args: unknown[]) => mockSetJSON(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  })),
}));

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
    mockGet.mockReset();
    mockSetJSON.mockReset();
    mockDelete.mockReset();
  });

  it("creates session with initial state", async () => {
    mockSetJSON.mockResolvedValue(undefined);

    const session = await createScoreTrainingSession("alex", {
      endMode: "rounds",
      roundCount: 10,
    });

    expect(session.slug).toBe("score-training");
    expect(session.state.currentScore).toBe(0);
    expect(session.state.currentRound).toBe(1);
    expect(session.timeRemainingSeconds).toBeNull();
    expect(mockSetJSON).toHaveBeenCalledWith(
      "alex:score-training",
      expect.any(Object)
    );
  });

  it("creates timed session with countdown", async () => {
    mockSetJSON.mockResolvedValue(undefined);

    const session = await createScoreTrainingSession("alex", {
      endMode: "timed",
      playtimeSeconds: 600,
    });

    expect(session.timeRemainingSeconds).toBe(600);
  });

  it("gets existing session", async () => {
    mockGet.mockResolvedValue({
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
    });

    const session = await getScoreTrainingSession("alex");

    expect(session?.state.currentScore).toBe(45);
  });

  it("returns null for legacy config blobs", async () => {
    mockGet.mockResolvedValue({
      slug: "score-training",
      settings: { targetScore: 10 },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(getScoreTrainingSession("alex")).resolves.toBeNull();
  });

  it("saves session", async () => {
    mockSetJSON.mockResolvedValue(undefined);

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

    expect(mockSetJSON).toHaveBeenCalledWith(
      "alex:score-training",
      expect.objectContaining({ slug: "score-training" })
    );
  });

  it("deletes session", async () => {
    mockDelete.mockResolvedValue(undefined);

    await deleteScoreTrainingSession("alex");

    expect(mockDelete).toHaveBeenCalledWith("alex:score-training");
  });
});

describe("player-score-training-stats data layer", () => {
  beforeEach(() => {
    mockDb.reset();
    mockGet.mockReset();
    mockSetJSON.mockReset();
    mockDelete.mockReset();
  });

  it("returns empty stats when none stored", async () => {
    await expect(getPlayerScoreTrainingStats(TEST_USER_ID)).resolves.toEqual(
      createEmptyScoreTrainingStats(),
    );
  });

  it("returns stored stats when found", async () => {
    mockDb.tables.playerScoreTrainingStats.set(TEST_USER_ID, {
      userId: TEST_USER_ID,
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

    expect(mockDb.tables.playerScoreTrainingStats.get(TEST_USER_ID)).toEqual({
      userId: TEST_USER_ID,
      gamesCompleted: 2,
      totalDartsThrown: 60,
      totalPointsScored: 180,
      bestVisitScore: 0,
      bestGameAverage: 0,
    });
  });
});
