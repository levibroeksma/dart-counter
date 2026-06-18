import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../../src/pages/api/games/singles-training/session/dart";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { createEmptySinglesTrainingStats } from "@lib/shared/games/singles-training/stats";

const mockGetSession = vi.fn();
const mockGetSinglesTrainingSession = vi.fn();
const mockSaveSinglesTrainingSession = vi.fn();
const mockDeleteSinglesTrainingSession = vi.fn();
const mockGetPlayerSinglesTrainingStats = vi.fn();
const mockSavePlayerSinglesTrainingStats = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/singles-training-session", () => ({
  getSinglesTrainingSession: (...args: unknown[]) =>
    mockGetSinglesTrainingSession(...args),
  saveSinglesTrainingSession: (...args: unknown[]) =>
    mockSaveSinglesTrainingSession(...args),
  deleteSinglesTrainingSession: (...args: unknown[]) =>
    mockDeleteSinglesTrainingSession(...args),
}));

vi.mock("@lib/server/data/player-singles-training-stats", () => ({
  getPlayerSinglesTrainingStats: (...args: unknown[]) =>
    mockGetPlayerSinglesTrainingStats(...args),
  savePlayerSinglesTrainingStats: (...args: unknown[]) =>
    mockSavePlayerSinglesTrainingStats(...args),
}));

const activeSession = {
  slug: "singles-training" as const,
  settings: {
    direction: "low-to-high" as const,
    mode: "normal" as const,
    scoring: "traditional" as const,
  },
  targetSequence: [1, "bull"] as const,
  state: {
    status: "active" as const,
    currentTargetIndex: 0,
    currentDartInVisit: 0 as const,
    score: 0,
    segmentCounts: { miss: 0, single: 0, double: 0, triple: 0 },
  },
  dartHistory: [],
  createdAt: "",
  updatedAt: "",
};

function createContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/games/singles-training/session/dart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/singles-training/session/dart", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetSinglesTrainingSession.mockReset();
    mockSaveSinglesTrainingSession.mockReset();
    mockDeleteSinglesTrainingSession.mockReset();
    mockGetPlayerSinglesTrainingStats.mockReset();
    mockSavePlayerSinglesTrainingStats.mockReset();

    mockGetSession.mockResolvedValue({ isLoggedIn: true, userId: "00000000-0000-4000-8000-000000000001" });
    mockGetSinglesTrainingSession.mockResolvedValue(structuredClone(activeSession));
    mockSaveSinglesTrainingSession.mockResolvedValue(undefined);
    mockDeleteSinglesTrainingSession.mockResolvedValue(undefined);
    mockGetPlayerSinglesTrainingStats.mockResolvedValue(
      createEmptySinglesTrainingStats(),
    );
    mockSavePlayerSinglesTrainingStats.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });

    const response = await POST(createContext({ outcome: { type: "single" } }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("returns 400 for invalid outcome on bull target", async () => {
    mockGetSinglesTrainingSession.mockResolvedValue({
      ...structuredClone(activeSession),
      targetSequence: ["bull"],
    });

    const response = await POST(createContext({ outcome: { type: "triple" } }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.INVALID_DART_OUTCOME,
    });
  });

  it("applies valid dart and saves active session", async () => {
    const response = await POST(createContext({ outcome: { type: "single" } }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.terminal).toBeUndefined();
    expect(data.session.state.score).toBe(1);
    expect(data.session.dartHistory).toHaveLength(1);
    expect(mockSaveSinglesTrainingSession).toHaveBeenCalledTimes(1);
    expect(mockDeleteSinglesTrainingSession).not.toHaveBeenCalled();
  });

  it("returns terminal summary and deletes session when hard mode dies", async () => {
    mockGetSinglesTrainingSession.mockResolvedValue({
      ...structuredClone(activeSession),
      settings: { ...activeSession.settings, mode: "hard" },
      state: { ...activeSession.state, currentDartInVisit: 2 },
      dartHistory: [
        {
          targetIndex: 0,
          dartInVisit: 0,
          outcome: { type: "miss" },
          points: 0,
        },
        {
          targetIndex: 0,
          dartInVisit: 1,
          outcome: { type: "miss" },
          points: 0,
        },
      ],
    });

    const response = await POST(createContext({ outcome: { type: "miss" } }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.terminal).toBe(true);
    expect(data.summary.status).toBe("dead");
    expect(mockSavePlayerSinglesTrainingStats).toHaveBeenCalledTimes(1);
    expect(mockDeleteSinglesTrainingSession).toHaveBeenCalledTimes(1);
    expect(mockSaveSinglesTrainingSession).not.toHaveBeenCalled();
  });

  it("returns terminal summary and saves stats when final target completes", async () => {
    mockGetSinglesTrainingSession.mockResolvedValue({
      ...structuredClone(activeSession),
      targetSequence: [...Array.from({ length: 20 }, (_, i) => i + 1), "bull"],
      state: {
        ...activeSession.state,
        currentTargetIndex: 20,
        currentDartInVisit: 2,
      },
      dartHistory: [
        {
          targetIndex: 20,
          dartInVisit: 0,
          outcome: { type: "single" },
          points: 1,
        },
        {
          targetIndex: 20,
          dartInVisit: 1,
          outcome: { type: "single" },
          points: 1,
        },
      ],
    });

    const response = await POST(createContext({ outcome: { type: "single" } }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.terminal).toBe(true);
    expect(data.summary.status).toBe("completed");
    expect(mockSavePlayerSinglesTrainingStats).toHaveBeenCalledTimes(1);
    expect(mockDeleteSinglesTrainingSession).toHaveBeenCalledTimes(1);
  });
});
