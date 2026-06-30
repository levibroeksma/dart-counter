import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "@api/games/score-training/complete";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  applyRoundToState,
  buildRoundRecord,
  buildScoreTrainingSession,
  createEmptyScoreTrainingStats,
} from "@lib/shared/games/score-training";

const mockGetSession = vi.fn();
const mockGetPlayerScoreTrainingStats = vi.fn();
const mockSavePlayerScoreTrainingStats = vi.fn();
const mockIncrementPlayCount = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/player-score-training-stats", () => ({
  getPlayerScoreTrainingStats: (...args: unknown[]) =>
    mockGetPlayerScoreTrainingStats(...args),
  savePlayerScoreTrainingStats: (...args: unknown[]) =>
    mockSavePlayerScoreTrainingStats(...args),
}));

vi.mock("@lib/server/data/games", () => ({
  incrementPlayCount: (...args: unknown[]) => mockIncrementPlayCount(...args),
}));

function buildCompletedRoundsSession() {
  const session = buildScoreTrainingSession({ endMode: "rounds", roundCount: 2 });
  for (let i = 0; i < 2; i++) {
    const round = buildRoundRecord(
      session.state.currentRound,
      60,
      session.state.currentScore,
    );
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);
  }
  return session;
}

function createContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/games/score-training/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/score-training/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      isLoggedIn: true,
      userId: "00000000-0000-4000-8000-000000000001",
    });
    mockGetPlayerScoreTrainingStats.mockResolvedValue(
      createEmptyScoreTrainingStats(),
    );
    mockSavePlayerScoreTrainingStats.mockResolvedValue(undefined);
    mockIncrementPlayCount.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });
    const response = await POST(createContext(buildCompletedRoundsSession()));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("returns 400 for incomplete session", async () => {
    const response = await POST(
      createContext(
        buildScoreTrainingSession({ endMode: "rounds", roundCount: 10 }),
      ),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.GAME_NOT_COMPLETE,
    });
  });

  it("saves stats, increments play count, and returns summary", async () => {
    const session = buildCompletedRoundsSession();
    const response = await POST(createContext(session));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.summary).toEqual({
      totalScore: 120,
      threeDartAverage: 60,
      roundsPlayed: 2,
      dartsThrown: 6,
    });
    expect(mockSavePlayerScoreTrainingStats).toHaveBeenCalledTimes(1);
    expect(mockIncrementPlayCount).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "score-training",
    );
  });
});
