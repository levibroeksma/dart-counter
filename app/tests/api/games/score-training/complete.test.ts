import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../../src/pages/api/games/score-training/session/complete";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { createEmptyScoreTrainingStats } from "@lib/shared/games/score-training/stats";

const mockGetSession = vi.fn();
const mockGetScoreTrainingSession = vi.fn();
const mockDeleteScoreTrainingSession = vi.fn();
const mockGetPlayerScoreTrainingStats = vi.fn();
const mockSavePlayerScoreTrainingStats = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/score-training-session", () => ({
  getScoreTrainingSession: (...args: unknown[]) =>
    mockGetScoreTrainingSession(...args),
  deleteScoreTrainingSession: (...args: unknown[]) =>
    mockDeleteScoreTrainingSession(...args),
}));

vi.mock("@lib/server/data/player-score-training-stats", () => ({
  getPlayerScoreTrainingStats: (...args: unknown[]) =>
    mockGetPlayerScoreTrainingStats(...args),
  savePlayerScoreTrainingStats: (...args: unknown[]) =>
    mockSavePlayerScoreTrainingStats(...args),
}));

const timedSession = {
  slug: "score-training" as const,
  settings: { endMode: "timed" as const, playtimeSeconds: 60 },
  state: {
    currentRound: 3,
    currentScore: 100,
    status: "active" as const,
    lastScore: 40,
  },
  roundHistory: [
    { roundNumber: 1, visitScore: 60, runningTotal: 60 },
    { roundNumber: 2, visitScore: 40, runningTotal: 100 },
  ],
  timeRemainingSeconds: 0,
  createdAt: "",
  updatedAt: "",
};

function createContext(body?: unknown): APIContext {
  return {
    request:
      body === undefined
        ? new Request("http://localhost/api/games/score-training/session/complete", {
            method: "POST",
          })
        : new Request("http://localhost/api/games/score-training/session/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/score-training/session/complete", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetScoreTrainingSession.mockReset();
    mockDeleteScoreTrainingSession.mockReset();
    mockGetPlayerScoreTrainingStats.mockReset();
    mockSavePlayerScoreTrainingStats.mockReset();

    mockGetSession.mockResolvedValue({ isLoggedIn: true, userId: "00000000-0000-4000-8000-000000000001" });
    mockGetScoreTrainingSession.mockResolvedValue(structuredClone(timedSession));
    mockDeleteScoreTrainingSession.mockResolvedValue(undefined);
    mockGetPlayerScoreTrainingStats.mockResolvedValue(
      createEmptyScoreTrainingStats()
    );
    mockSavePlayerScoreTrainingStats.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });

    const response = await POST(createContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("returns 400 when session uses rounds mode", async () => {
    mockGetScoreTrainingSession.mockResolvedValue({
      ...structuredClone(timedSession),
      settings: { endMode: "rounds", roundCount: 10 },
      timeRemainingSeconds: null,
    });

    const response = await POST(createContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.INVALID_GAME_SETTINGS,
    });
  });

  it("returns 400 when game already completed", async () => {
    mockGetScoreTrainingSession.mockResolvedValue({
      ...structuredClone(timedSession),
      state: { ...structuredClone(timedSession.state), status: "completed" },
    });

    const response = await POST(createContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.GAME_COMPLETED,
    });
  });

  it("completes timed session and returns summary", async () => {
    const response = await POST(createContext({ timeRemainingSeconds: 0 }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.completed).toBe(true);
    expect(data.summary).toEqual({
      totalScore: 100,
      threeDartAverage: 50,
      roundsPlayed: 2,
      dartsThrown: 6,
    });
    expect(mockSavePlayerScoreTrainingStats).toHaveBeenCalledTimes(1);
    expect(mockDeleteScoreTrainingSession).toHaveBeenCalledTimes(1);
  });
});
