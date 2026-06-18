import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../../src/pages/api/games/ten-up-one-down/session/round";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { createEmptyPlayerDartStats } from "@lib/shared/stats/double-stats";

const mockGetSession = vi.fn();
const mockGetTuodSession = vi.fn();
const mockSaveTuodSession = vi.fn();
const mockDeleteTuodSession = vi.fn();
const mockGetPlayerStats = vi.fn();
const mockSavePlayerStats = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/ten-up-one-down-session", () => ({
  getTenUpOneDownSession: (...args: unknown[]) => mockGetTuodSession(...args),
  saveTenUpOneDownSession: (...args: unknown[]) =>
    mockSaveTuodSession(...args),
  deleteTenUpOneDownSession: (...args: unknown[]) =>
    mockDeleteTuodSession(...args),
}));

vi.mock("@lib/server/data/player-dart-stats", () => ({
  getPlayerDartStats: (...args: unknown[]) => mockGetPlayerStats(...args),
  savePlayerDartStats: (...args: unknown[]) => mockSavePlayerStats(...args),
}));

const authState: { isLoggedIn: boolean; userId?: string } = {
  isLoggedIn: true,
  userId: "00000000-0000-4000-8000-000000000001",
};

const activeSession = {
  slug: "ten-up-one-down" as const,
  settings: { endMode: "rounds" as const, roundCount: 10 },
  state: {
    currentRound: 1,
    currentTarget: 41,
    status: "active" as const,
    lastAdjustment: null,
  },
  roundHistory: [],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

const validRound = {
  roundNumber: 1,
  targetAtStart: 41,
  targetAfter: 41,
  finished: true,
  dartsUsed: 2,
  dartsOnDouble: 1,
};

function createContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/games/ten-up-one-down/session/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/ten-up-one-down/session/round", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetTuodSession.mockReset();
    mockSaveTuodSession.mockReset();
    mockDeleteTuodSession.mockReset();
    mockGetPlayerStats.mockReset();
    mockSavePlayerStats.mockReset();

    mockGetSession.mockResolvedValue(authState);
    mockGetTuodSession.mockResolvedValue(structuredClone(activeSession));
    mockSaveTuodSession.mockResolvedValue(undefined);
    mockDeleteTuodSession.mockResolvedValue(undefined);
    mockGetPlayerStats.mockResolvedValue(createEmptyPlayerDartStats());
    mockSavePlayerStats.mockResolvedValue(undefined);
  });

  it("returns 401 when not logged in", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });

    const response = await POST(createContext(validRound));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("returns 404 when no active session", async () => {
    mockGetTuodSession.mockResolvedValue(null);

    const response = await POST(createContext(validRound));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.NO_ACTIVE_SESSION,
    });
  });

  it("submits valid round and updates session", async () => {
    const response = await POST(createContext(validRound));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.state.currentTarget).toBe(51);
    expect(data.session.roundHistory).toHaveLength(1);
    expect(mockSavePlayerStats).toHaveBeenCalledTimes(1);
    expect(mockSaveTuodSession).toHaveBeenCalledTimes(1);
    expect(mockDeleteTuodSession).not.toHaveBeenCalled();
  });

  it("completes and deletes session when timerExpired is true", async () => {
    const timedSession = {
      ...structuredClone(activeSession),
      settings: { endMode: "timed" as const, playtimeSeconds: 60 },
      timeRemainingSeconds: 0,
    };
    mockGetTuodSession.mockResolvedValue(timedSession);

    const response = await POST(
      createContext({ round: validRound, timerExpired: true })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.completed).toBe(true);
    expect(mockDeleteTuodSession).toHaveBeenCalledTimes(1);
    expect(mockSaveTuodSession).not.toHaveBeenCalled();
  });

  it("rejects invalid round payload", async () => {
    const response = await POST(
      createContext({ ...validRound, dartsOnDouble: 3, dartsUsed: 2 })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.INVALID_ROUND,
    });
  });
});
