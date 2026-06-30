import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "@api/games/ten-up-one-down/complete";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { createEmptyPlayerDartStats } from "@lib/shared/stats/double-stats";
import { buildTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session-factory";
import { applyRoundToState } from "@lib/shared/games/ten-up-one-down/state";
import { buildRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

const mockGetSession = vi.fn();
const mockGetPlayerDartStats = vi.fn();
const mockSavePlayerDartStats = vi.fn();
const mockIncrementPlayCount = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/player-dart-stats", () => ({
  getPlayerDartStats: (...args: unknown[]) => mockGetPlayerDartStats(...args),
  savePlayerDartStats: (...args: unknown[]) => mockSavePlayerDartStats(...args),
}));

vi.mock("@lib/server/data/games", () => ({
  incrementPlayCount: (...args: unknown[]) => mockIncrementPlayCount(...args),
}));

function buildCompletedRoundsSession() {
  const session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 2 });
  for (let i = 0; i < 2; i++) {
    const round = buildRoundRecord(session.state.currentRound, session.state.currentTarget, {
      outcome: "failure",
      dartsUsed: 3,
      dartsOnDouble: 0,
    });
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);
  }
  return session;
}

function createContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/games/ten-up-one-down/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/ten-up-one-down/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      isLoggedIn: true,
      userId: "00000000-0000-4000-8000-000000000001",
    });
    mockGetPlayerDartStats.mockResolvedValue(createEmptyPlayerDartStats());
    mockSavePlayerDartStats.mockResolvedValue(undefined);
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
      createContext(buildTenUpOneDownSession({ endMode: "rounds", roundCount: 10 })),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.GAME_NOT_COMPLETE,
    });
  });

  it("saves stats, increments play count, and returns summary", async () => {
    const session = buildCompletedRoundsSession();
    const response = await POST(createContext({ session }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.summary).toEqual({
      completionReason: "rounds",
      roundsPlayed: 2,
      checkouts: 0,
      doubleHitPercentage: 0,
      finalTarget: 39,
      peakTarget: 41,
    });
    expect(mockSavePlayerDartStats).toHaveBeenCalledTimes(1);
    expect(mockIncrementPlayCount).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "ten-up-one-down",
    );
  });
});
