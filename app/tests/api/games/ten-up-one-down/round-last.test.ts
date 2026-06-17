import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { DELETE } from "../../../../src/pages/api/games/ten-up-one-down/session/round/last";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { createEmptyPlayerDartStats } from "@lib/shared/stats/double-stats";

const mockGetSession = vi.fn();
const mockGetTuodSession = vi.fn();
const mockSaveTuodSession = vi.fn();
const mockGetPlayerStats = vi.fn();
const mockSavePlayerStats = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/ten-up-one-down-session", () => ({
  getTenUpOneDownSession: (...args: unknown[]) => mockGetTuodSession(...args),
  saveTenUpOneDownSession: (...args: unknown[]) =>
    mockSaveTuodSession(...args),
}));

vi.mock("@lib/server/data/player-dart-stats", () => ({
  getPlayerDartStats: (...args: unknown[]) => mockGetPlayerStats(...args),
  savePlayerDartStats: (...args: unknown[]) => mockSavePlayerStats(...args),
}));

const roundRecord = {
  roundNumber: 1,
  targetAtStart: 41,
  targetAfter: 51,
  finished: true,
  dartsUsed: 2,
  dartsOnDouble: 1,
};

const activeSession = {
  slug: "ten-up-one-down" as const,
  settings: { endMode: "rounds" as const, roundCount: 10 },
  state: {
    currentRound: 2,
    currentTarget: 51,
    status: "active" as const,
    lastAdjustment: "success" as const,
  },
  roundHistory: [roundRecord],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

function createContext(): APIContext {
  return {
    request: new Request(
      "http://localhost/api/games/ten-up-one-down/session/round/last",
      { method: "DELETE" }
    ),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("DELETE /api/games/ten-up-one-down/session/round/last", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ isLoggedIn: true, username: "alex" });
    mockGetTuodSession.mockResolvedValue(structuredClone(activeSession));
    const stats = createEmptyPlayerDartStats();
    stats.doubleAttempts = 1;
    stats.doubleHits = 1;
    stats.totalCheckouts = 1;
    stats.totalCheckoutDarts = 2;
    mockGetPlayerStats.mockResolvedValue(stats);
    mockSaveTuodSession.mockResolvedValue(undefined);
    mockSavePlayerStats.mockResolvedValue(undefined);
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

  it("reverts last round and stats", async () => {
    const response = await DELETE(createContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.state.currentTarget).toBe(41);
    expect(data.session.state.currentRound).toBe(1);
    expect(data.session.roundHistory).toHaveLength(0);
    expect(mockSavePlayerStats).toHaveBeenCalledTimes(1);
    expect(mockSaveTuodSession).toHaveBeenCalledTimes(1);
  });

  it("restores active status from completed", async () => {
    mockGetTuodSession.mockResolvedValue({
      ...structuredClone(activeSession),
      settings: { endMode: "rounds", roundCount: 1 },
      state: {
        currentRound: 2,
        currentTarget: 51,
        status: "completed",
        lastAdjustment: "success",
      },
    });

    const response = await DELETE(createContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.state.status).toBe("active");
  });

  it("returns 400 when no round to undo", async () => {
    mockGetTuodSession.mockResolvedValue({
      ...structuredClone(activeSession),
      roundHistory: [],
    });

    const response = await DELETE(createContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.INVALID_ROUND,
    });
  });
});
