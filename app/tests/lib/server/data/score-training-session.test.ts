import { describe, it, expect, vi, beforeEach } from "vitest";

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
