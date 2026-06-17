import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { DELETE } from "../../../../src/pages/api/games/score-training/session/round/last";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockGetSession = vi.fn();
const mockGetScoreTrainingSession = vi.fn();
const mockSaveScoreTrainingSession = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/score-training-session", () => ({
  getScoreTrainingSession: (...args: unknown[]) =>
    mockGetScoreTrainingSession(...args),
  saveScoreTrainingSession: (...args: unknown[]) =>
    mockSaveScoreTrainingSession(...args),
}));

const sessionWithRounds = {
  slug: "score-training" as const,
  settings: { endMode: "rounds" as const, roundCount: 10 },
  state: {
    currentRound: 3,
    currentScore: 100,
    status: "completed" as const,
    lastScore: 40,
  },
  roundHistory: [
    { roundNumber: 1, visitScore: 60, runningTotal: 60 },
    { roundNumber: 2, visitScore: 40, runningTotal: 100 },
  ],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

function createContext(): APIContext {
  return {
    request: new Request(
      "http://localhost/api/games/score-training/session/round/last",
      { method: "DELETE" }
    ),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("DELETE /api/games/score-training/session/round/last", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetScoreTrainingSession.mockReset();
    mockSaveScoreTrainingSession.mockReset();

    mockGetSession.mockResolvedValue({ isLoggedIn: true, username: "alex" });
    mockGetScoreTrainingSession.mockResolvedValue(
      structuredClone(sessionWithRounds)
    );
    mockSaveScoreTrainingSession.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });

    const response = await DELETE(createContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("returns 400 when no rounds can be undone", async () => {
    mockGetScoreTrainingSession.mockResolvedValue({
      ...structuredClone(sessionWithRounds),
      roundHistory: [],
    });

    const response = await DELETE(createContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.NO_ROUNDS_TO_UNDO,
    });
  });

  it("reverts the last round and does not touch global stats", async () => {
    const response = await DELETE(createContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.roundHistory).toHaveLength(1);
    expect(data.session.state.currentRound).toBe(2);
    expect(data.session.state.currentScore).toBe(60);
    expect(data.session.state.lastScore).toBe(60);
    expect(data.session.state.status).toBe("active");
    expect(mockSaveScoreTrainingSession).toHaveBeenCalledTimes(1);
  });
});
