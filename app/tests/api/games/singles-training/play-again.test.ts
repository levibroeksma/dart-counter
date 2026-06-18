import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../../src/pages/api/games/singles-training/session/play-again";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockGetSession = vi.fn();
const mockGetSinglesTrainingSession = vi.fn();
const mockDeleteSinglesTrainingSession = vi.fn();
const mockCreateSinglesTrainingSession = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/singles-training-session", () => ({
  getSinglesTrainingSession: (...args: unknown[]) =>
    mockGetSinglesTrainingSession(...args),
  deleteSinglesTrainingSession: (...args: unknown[]) =>
    mockDeleteSinglesTrainingSession(...args),
  createSinglesTrainingSession: (...args: unknown[]) =>
    mockCreateSinglesTrainingSession(...args),
}));

const settings = {
  direction: "high-to-low" as const,
  mode: "extreme" as const,
  scoring: "uniform" as const,
};

const newSession = {
  slug: "singles-training" as const,
  settings,
  targetSequence: ["bull", 20, 19] as const,
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

function createContext(body?: unknown): APIContext {
  return {
    request:
      body === undefined
        ? new Request("http://localhost/api/games/singles-training/session/play-again", {
            method: "POST",
          })
        : new Request("http://localhost/api/games/singles-training/session/play-again", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/singles-training/session/play-again", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetSinglesTrainingSession.mockReset();
    mockDeleteSinglesTrainingSession.mockReset();
    mockCreateSinglesTrainingSession.mockReset();

    mockGetSession.mockResolvedValue({ isLoggedIn: true, userId: "00000000-0000-4000-8000-000000000001" });
    mockDeleteSinglesTrainingSession.mockResolvedValue(undefined);
    mockCreateSinglesTrainingSession.mockResolvedValue(structuredClone(newSession));
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });

    const response = await POST(createContext(settings));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("creates new session from settings in request body", async () => {
    const response = await POST(createContext(settings));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.slug).toBe("singles-training");
    expect(mockCreateSinglesTrainingSession).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", settings);
  });

  it("uses settings from terminal session when body is missing", async () => {
    mockGetSinglesTrainingSession.mockResolvedValue({
      ...structuredClone(newSession),
      state: { ...newSession.state, status: "completed" },
    });

    const response = await POST(createContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockGetSinglesTrainingSession).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
    expect(mockCreateSinglesTrainingSession).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", settings);
  });

  it("returns 404 when no body settings and no existing session", async () => {
    mockGetSinglesTrainingSession.mockResolvedValue(null);

    const response = await POST(createContext());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.NO_ACTIVE_SESSION,
    });
  });
});
