import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEmptySinglesTrainingStats } from "@lib/shared/games/singles-training/stats";

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
    mockGet.mockReset();
    mockSetJSON.mockReset();
    mockDelete.mockReset();
  });

  it("returns empty stats when none stored", async () => {
    mockGet.mockResolvedValue(null);

    const stats = await getPlayerSinglesTrainingStats("alex");

    expect(stats).toEqual(createEmptySinglesTrainingStats());
  });

  it("returns stored stats when found", async () => {
    mockGet.mockResolvedValue({
      ...createEmptySinglesTrainingStats(),
      gamesCompleted: 4,
      totalScore: 123,
    });

    const stats = await getPlayerSinglesTrainingStats("alex");

    expect(stats.gamesCompleted).toBe(4);
    expect(stats.totalScore).toBe(123);
  });

  it("saves stats for user key", async () => {
    mockSetJSON.mockResolvedValue(undefined);
    const stats = createEmptySinglesTrainingStats();
    stats.gamesCompleted = 2;

    await savePlayerSinglesTrainingStats("alex", stats);

    expect(mockSetJSON).toHaveBeenCalledWith("alex", stats);
  });
});
