import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../../src/pages/api/games/score-training/session/round";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { createEmptyScoreTrainingStats } from "@lib/shared/games/score-training/stats";

const mockGetSession = vi.fn();
const mockGetScoreTrainingSession = vi.fn();
const mockSaveScoreTrainingSession = vi.fn();
const mockDeleteScoreTrainingSession = vi.fn();
const mockGetPlayerScoreTrainingStats = vi.fn();
const mockSavePlayerScoreTrainingStats = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/score-training-session", () => ({
  getScoreTrainingSession: (...args: unknown[]) =>
    mockGetScoreTrainingSession(...args),
  saveScoreTrainingSession: (...args: unknown[]) =>
    mockSaveScoreTrainingSession(...args),
  deleteScoreTrainingSession: (...args: unknown[]) =>
    mockDeleteScoreTrainingSession(...args),
}));

vi.mock("@lib/server/data/player-score-training-stats", () => ({
  getPlayerScoreTrainingStats: (...args: unknown[]) =>
    mockGetPlayerScoreTrainingStats(...args),
  savePlayerScoreTrainingStats: (...args: unknown[]) =>
    mockSavePlayerScoreTrainingStats(...args),
}));

const activeSession = {
  slug: "score-training" as const,
  settings: { endMode: "rounds" as const, roundCount: 10 },
  state: {
    currentRound: 1,
    currentScore: 0,
    status: "active" as const,
    lastScore: null,
  },
  roundHistory: [],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

const validRound = {
  roundNumber: 1,
  visitScore: 60,
  runningTotal: 60,
};

function createContext(body: unknown): APIContext {
  return {
    request: new Request(
      "http://localhost/api/games/score-training/session/round",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/score-training/session/round", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetScoreTrainingSession.mockReset();
    mockSaveScoreTrainingSession.mockReset();
    mockDeleteScoreTrainingSession.mockReset();
    mockGetPlayerScoreTrainingStats.mockReset();
    mockSavePlayerScoreTrainingStats.mockReset();

    mockGetSession.mockResolvedValue({ isLoggedIn: true, userId: "00000000-0000-4000-8000-000000000001" });
    mockGetScoreTrainingSession.mockResolvedValue(structuredClone(activeSession));
    mockSaveScoreTrainingSession.mockResolvedValue(undefined);
    mockDeleteScoreTrainingSession.mockResolvedValue(undefined);
    mockGetPlayerScoreTrainingStats.mockResolvedValue(
      createEmptyScoreTrainingStats()
    );
    mockSavePlayerScoreTrainingStats.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });

    const response = await POST(createContext({ round: validRound }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("returns 404 when session is missing", async () => {
    mockGetScoreTrainingSession.mockResolvedValue(null);

    const response = await POST(createContext({ round: validRound }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.NO_ACTIVE_SESSION,
    });
  });

  it("returns 400 when game is already completed", async () => {
    mockGetScoreTrainingSession.mockResolvedValue({
      ...structuredClone(activeSession),
      state: {
        ...structuredClone(activeSession.state),
        status: "completed",
      },
    });

    const response = await POST(createContext({ round: validRound }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.GAME_COMPLETED,
    });
  });

  it("returns 400 for invalid round payload", async () => {
    const response = await POST(
      createContext({ round: { ...validRound, visitScore: 181 } })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.INVALID_SCORE,
    });
  });

  it("applies round, updates timer, and saves active session", async () => {
    const response = await POST(
      createContext({ round: validRound, timeRemainingSeconds: 55 })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.completed).toBeUndefined();
    expect(data.session.roundHistory).toHaveLength(1);
    expect(data.session.state.currentRound).toBe(2);
    expect(data.session.state.currentScore).toBe(60);
    expect(data.session.timeRemainingSeconds).toBe(55);
    expect(mockSaveScoreTrainingSession).toHaveBeenCalledTimes(1);
    expect(mockDeleteScoreTrainingSession).not.toHaveBeenCalled();
    expect(mockSavePlayerScoreTrainingStats).not.toHaveBeenCalled();
  });

  it("completes on final round and applies global stats once", async () => {
    mockGetScoreTrainingSession.mockResolvedValue({
      ...structuredClone(activeSession),
      settings: { endMode: "rounds", roundCount: 1 },
    });

    const response = await POST(
      createContext({ round: validRound, timerExpired: false })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.completed).toBe(true);
    expect(data.summary).toEqual({
      totalScore: 60,
      threeDartAverage: 60,
      roundsPlayed: 1,
      dartsThrown: 3,
    });
    expect(mockSavePlayerScoreTrainingStats).toHaveBeenCalledTimes(1);
    expect(mockDeleteScoreTrainingSession).toHaveBeenCalledTimes(1);
    expect(mockSaveScoreTrainingSession).not.toHaveBeenCalled();
  });
});
