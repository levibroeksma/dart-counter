import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { DELETE } from "../../../../src/pages/api/games/singles-training/session/dart/last";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockGetSession = vi.fn();
const mockGetSinglesTrainingSession = vi.fn();
const mockSaveSinglesTrainingSession = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/singles-training-session", () => ({
  getSinglesTrainingSession: (...args: unknown[]) =>
    mockGetSinglesTrainingSession(...args),
  saveSinglesTrainingSession: (...args: unknown[]) =>
    mockSaveSinglesTrainingSession(...args),
}));

const sessionWithDarts = {
  slug: "singles-training" as const,
  settings: {
    direction: "low-to-high" as const,
    mode: "hard" as const,
    scoring: "traditional" as const,
  },
  targetSequence: [1, 2] as const,
  state: {
    status: "dead" as const,
    currentTargetIndex: 1,
    currentDartInVisit: 0 as const,
    score: 1,
    segmentCounts: { miss: 2, single: 1, double: 0, triple: 0 },
  },
  dartHistory: [
    {
      targetIndex: 0,
      dartInVisit: 0,
      outcome: { type: "single" as const },
      points: 1,
    },
    {
      targetIndex: 0,
      dartInVisit: 1,
      outcome: { type: "miss" as const },
      points: 0,
    },
    {
      targetIndex: 0,
      dartInVisit: 2,
      outcome: { type: "miss" as const },
      points: 0,
    },
  ],
  createdAt: "",
  updatedAt: "",
};

function createContext(): APIContext {
  return {
    request: new Request("http://localhost/api/games/singles-training/session/dart/last", {
      method: "DELETE",
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("DELETE /api/games/singles-training/session/dart/last", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetSinglesTrainingSession.mockReset();
    mockSaveSinglesTrainingSession.mockReset();

    mockGetSession.mockResolvedValue({ isLoggedIn: true, username: "alex" });
    mockGetSinglesTrainingSession.mockResolvedValue(structuredClone(sessionWithDarts));
    mockSaveSinglesTrainingSession.mockResolvedValue(undefined);
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

  it("returns 400 when no darts can be undone", async () => {
    mockGetSinglesTrainingSession.mockResolvedValue({
      ...structuredClone(sessionWithDarts),
      dartHistory: [],
    });

    const response = await DELETE(createContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.NO_DARTS_TO_UNDO,
    });
  });

  it("reverts last dart and restores active status", async () => {
    const response = await DELETE(createContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.dartHistory).toHaveLength(2);
    expect(data.session.state.status).toBe("active");
    expect(data.session.state.currentTargetIndex).toBe(0);
    expect(data.session.state.currentDartInVisit).toBe(2);
    expect(mockSaveSinglesTrainingSession).toHaveBeenCalledTimes(1);
  });
});
