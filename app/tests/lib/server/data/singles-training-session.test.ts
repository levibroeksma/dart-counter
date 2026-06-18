import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEmptySinglesTrainingStats } from "@lib/shared/games/singles-training/stats";
import "@tests/helpers/mock-db";
import { mockDb } from "@tests/helpers/mock-db";
import { TEST_USER_ID } from "@tests/helpers/constants";

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
  createSinglesTrainingSession,
  getSinglesTrainingSession,
  saveSinglesTrainingSession,
  deleteSinglesTrainingSession,
} from "@lib/server/data/singles-training-session";
import {
  getPlayerSinglesTrainingStats,
  savePlayerSinglesTrainingStats,
} from "@lib/server/data/player-singles-training-stats";

describe("singles-training session data layer", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSetJSON.mockReset();
    mockDelete.mockReset();
  });

  it("creates session with initial state and target sequence", async () => {
    mockSetJSON.mockResolvedValue(undefined);

    const session = await createSinglesTrainingSession("alex", {
      direction: "low-to-high",
      mode: "normal",
      scoring: "traditional",
    });

    expect(session.slug).toBe("singles-training");
    expect(session.state.status).toBe("active");
    expect(session.state.currentTargetIndex).toBe(0);
    expect(session.state.currentDartInVisit).toBe(0);
    expect(session.state.score).toBe(0);
    expect(session.targetSequence).toEqual([...Array.from({ length: 20 }, (_, i) => i + 1), "bull"]);
    expect(mockSetJSON).toHaveBeenCalledWith(
      "alex:singles-training",
      expect.any(Object)
    );
  });

  it("gets existing session", async () => {
    mockGet.mockResolvedValue({
      slug: "singles-training",
      settings: {
        direction: "high-to-low",
        mode: "hard",
        scoring: "uniform",
      },
      targetSequence: ["bull", 20, 19],
      state: {
        status: "active",
        currentTargetIndex: 1,
        currentDartInVisit: 2,
        score: 4,
        segmentCounts: {
          miss: 1,
          single: 2,
          double: 0,
          triple: 0,
        },
      },
      dartHistory: [],
      createdAt: "",
      updatedAt: "",
    });

    const session = await getSinglesTrainingSession("alex");

    expect(session?.slug).toBe("singles-training");
    expect(session?.state.score).toBe(4);
  });

  it("returns null for invalid blob shape", async () => {
    mockGet.mockResolvedValue({
      slug: "singles-training",
      settings: { mode: "normal" },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(getSinglesTrainingSession("alex")).resolves.toBeNull();
  });

  it("saves session", async () => {
    mockSetJSON.mockResolvedValue(undefined);

    await saveSinglesTrainingSession("alex", {
      slug: "singles-training",
      settings: {
        direction: "random",
        mode: "extreme",
        scoring: "traditional",
      },
      targetSequence: [10, 11, "bull"],
      state: {
        status: "active",
        currentTargetIndex: 0,
        currentDartInVisit: 1,
        score: 2,
        segmentCounts: {
          miss: 0,
          single: 1,
          double: 0,
          triple: 0,
        },
      },
      dartHistory: [],
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    });

    expect(mockSetJSON).toHaveBeenCalledWith(
      "alex:singles-training",
      expect.objectContaining({ slug: "singles-training" })
    );
  });

  it("deletes session", async () => {
    mockDelete.mockResolvedValue(undefined);

    await deleteSinglesTrainingSession("alex");

    expect(mockDelete).toHaveBeenCalledWith("alex:singles-training");
  });
});

describe("player-singles-training-stats data layer", () => {
  beforeEach(() => {
    mockDb.reset();
    mockGet.mockReset();
    mockSetJSON.mockReset();
    mockDelete.mockReset();
  });

  it("returns empty stats when none stored", async () => {
    const stats = await getPlayerSinglesTrainingStats(TEST_USER_ID);

    expect(stats).toEqual(createEmptySinglesTrainingStats());
  });

  it("returns stored stats when found", async () => {
    mockDb.tables.playerSinglesTrainingStats.set(TEST_USER_ID, {
      userId: TEST_USER_ID,
      gamesCompleted: 4,
      gamesFailed: 1,
      totalDartsThrown: 90,
      totalHits: 40,
      totalScore: 123,
      dartPositionHits: [10, 14, 16],
      dartPositionAttempts: [30, 30, 30],
      bestHitRatio: 0.45,
      bestScore: 50,
    });

    const stats = await getPlayerSinglesTrainingStats(TEST_USER_ID);

    expect(stats.gamesCompleted).toBe(4);
    expect(stats.totalScore).toBe(123);
  });

  it("saves stats for user key", async () => {
    const stats = createEmptySinglesTrainingStats();
    stats.gamesCompleted = 2;
    stats.dartPositionHits = [1, 2, 3];
    stats.dartPositionAttempts = [3, 3, 3];

    await savePlayerSinglesTrainingStats(TEST_USER_ID, stats);

    expect(mockDb.tables.playerSinglesTrainingStats.get(TEST_USER_ID)).toEqual({
      userId: TEST_USER_ID,
      gamesCompleted: 2,
      gamesFailed: 0,
      totalDartsThrown: 0,
      totalHits: 0,
      totalScore: 0,
      dartPositionHits: [1, 2, 3],
      dartPositionAttempts: [3, 3, 3],
      bestHitRatio: 0,
      bestScore: 0,
    });
  });
});
